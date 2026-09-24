"""Coverage for the home-page showcase: admin upload/list/edit/reorder/
delete, and the public endpoint the slideshow reads from — including that
inactive photos stay off the public page, bad files are rejected without
sinking good ones uploaded alongside them, and deleting a photo removes
its file from disk.

The uploads directory is redirected to a per-test temp dir (the shared
conftest doesn't do this), so these tests never write into the real
backend/data/uploads.
"""
from __future__ import annotations

import struct
import zlib

import pytest
from sqlalchemy import delete, func, select

from app import showcase_service
from app.config import settings
from app.db import session_scope
from app.models import ShowcaseImage


def _png(seed: int = 0) -> bytes:
    """A real, valid 1x1 PNG. `seed` varies the pixel so each call yields
    distinct bytes."""
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = b"\x00" + bytes([seed % 256, 0, 0])
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def _jpeg() -> bytes:
    return b"\xff\xd8\xff\xe0" + b"\x00" * 32


def _webp() -> bytes:
    return b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 16


ICO = b"\x00\x00\x01\x00" + b"\x00" * 32


def _files(*items):
    """items: (filename, bytes) pairs -> the multipart `files` field."""
    return [("files", (name, data, "application/octet-stream")) for name, data in items]


def _clear_rows():
    with session_scope() as db:
        db.execute(delete(ShowcaseImage))


@pytest.fixture(autouse=True)
def _isolated_showcase(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOADS_DIR", tmp_path)
    _clear_rows()
    yield tmp_path
    _clear_rows()


def _upload(logged_in_client, *items):
    resp = logged_in_client.post("/admin/api/showcase", files=_files(*items))
    assert resp.status_code == 200, resp.text
    return resp.json()


def _three(logged_in_client):
    body = _upload(logged_in_client, ("a.png", _png(1)), ("b.jpg", _jpeg()), ("c.webp", _webp()))
    assert body["errors"] == []
    return [i["id"] for i in body["created"]]


# --- public endpoint ---------------------------------------------------

def test_public_showcase_is_empty_by_default(client):
    resp = client.get("/api/showcase")
    assert resp.status_code == 200
    assert resp.json() == []


def test_upload_multiple_photos_appear_publicly_in_order(client, logged_in_client, tmp_path):
    body = _upload(logged_in_client, ("a.png", _png(1)), ("b.jpg", _jpeg()), ("c.webp", _webp()))
    assert body["errors"] == []
    created = body["created"]
    assert [i["position"] for i in created] == [0, 1, 2]
    assert [i["url"].rsplit(".", 1)[1] for i in created] == ["png", "jpg", "webp"]

    # Files really landed in the (temp) uploads dir under server-made names.
    on_disk = {p.name for p in tmp_path.iterdir()}
    assert on_disk == {i["url"].removeprefix("/uploads/") for i in created}
    assert not any(n.startswith(("a.", "b.", "c.")) for n in on_disk)

    public = client.get("/api/showcase")
    assert public.status_code == 200
    assert [i["id"] for i in public.json()] == [i["id"] for i in created]
    # Public shape is trimmed — no admin/audit fields leak.
    assert set(public.json()[0]) == {"id", "url", "caption"}
    assert "max-age" in public.headers["cache-control"]


def test_inactive_photo_is_hidden_publicly_but_kept_for_admin(client, logged_in_client):
    ids = _three(logged_in_client)
    logged_in_client.patch(f"/admin/api/showcase/{ids[1]}", json={"isActive": False}).raise_for_status()

    assert [i["id"] for i in client.get("/api/showcase").json()] == [ids[0], ids[2]]
    admin_list = logged_in_client.get("/admin/api/showcase").json()
    assert [i["id"] for i in admin_list] == ids
    assert admin_list[1]["isActive"] is False


# --- upload validation -------------------------------------------------

def test_bad_files_are_reported_without_blocking_good_ones(logged_in_client, tmp_path):
    body = _upload(
        logged_in_client,
        ("good.png", _png(2)),
        ("notes.txt", b"definitely not an image"),
        ("favicon.ico", ICO),
        ("empty.png", b""),
        ("disguised.png", b"<svg onload=alert(1)></svg>"),  # right extension, wrong bytes
    )
    assert len(body["created"]) == 1
    assert {e["filename"] for e in body["errors"]} == {"notes.txt", "favicon.ico", "empty.png", "disguised.png"}
    assert len(list(tmp_path.iterdir())) == 1  # only the good one was written
    assert len(logged_in_client.get("/admin/api/showcase").json()) == 1


def test_all_invalid_uploads_return_errors_and_store_nothing(logged_in_client, tmp_path):
    body = _upload(logged_in_client, ("x.txt", b"nope"))
    assert body["created"] == []
    assert len(body["errors"]) == 1
    assert list(tmp_path.iterdir()) == []


def test_oversize_photo_is_rejected(logged_in_client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "MAX_SHOWCASE_IMAGE_BYTES", 100)
    big = b"\x89PNG\r\n\x1a\n" + b"0" * 200
    body = _upload(logged_in_client, ("big.png", big), ("small.png", _png(3)))
    assert [e["filename"] for e in body["errors"]] == ["big.png"]
    assert "limit" in body["errors"][0]["detail"]
    assert len(body["created"]) == 1
    assert len(list(tmp_path.iterdir())) == 1


def test_too_many_files_in_one_request_is_rejected(logged_in_client):
    from app.routers.admin_showcase import MAX_FILES_PER_UPLOAD

    items = [(f"{i}.png", _png(i)) for i in range(MAX_FILES_PER_UPLOAD + 1)]
    resp = logged_in_client.post("/admin/api/showcase", files=_files(*items))
    assert resp.status_code == 400


def test_upload_with_no_files_is_rejected(logged_in_client):
    resp = logged_in_client.post("/admin/api/showcase")
    assert resp.status_code in (400, 422)


def test_failed_upload_rolls_back_and_removes_written_files(logged_in_client, monkeypatch, tmp_path):
    real_create = showcase_service.create_image
    calls = {"n": 0}

    def flaky_create(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("boom")
        return real_create(*args, **kwargs)

    monkeypatch.setattr(showcase_service, "create_image", flaky_create)
    with pytest.raises(RuntimeError):
        logged_in_client.post("/admin/api/showcase", files=_files(("a.png", _png(4)), ("b.png", _png(5))))

    # Neither a row nor a file survives a mid-batch failure.
    assert list(tmp_path.iterdir()) == []
    with session_scope() as db:
        assert db.scalar(select(func.count()).select_from(ShowcaseImage)) == 0


# --- edit / reorder / delete ------------------------------------------

def test_update_caption_and_validation(logged_in_client):
    image_id = _three(logged_in_client)[0]

    resp = logged_in_client.patch(f"/admin/api/showcase/{image_id}", json={"caption": "  Kiln line 2  "})
    assert resp.status_code == 200
    assert resp.json()["caption"] == "Kiln line 2"

    too_long = logged_in_client.patch(f"/admin/api/showcase/{image_id}", json={"caption": "x" * 201})
    assert too_long.status_code == 400

    missing = logged_in_client.patch("/admin/api/showcase/nope", json={"caption": "hi"})
    assert missing.status_code == 404


def test_reorder_changes_admin_and_public_order(client, logged_in_client):
    a, b, c = _three(logged_in_client)

    resp = logged_in_client.post("/admin/api/showcase/reorder", json={"orderedIds": [c, a, b]})
    assert resp.status_code == 200
    assert [i["id"] for i in resp.json()] == [c, a, b]
    assert [i["position"] for i in resp.json()] == [0, 1, 2]

    assert [i["id"] for i in logged_in_client.get("/admin/api/showcase").json()] == [c, a, b]
    assert [i["id"] for i in client.get("/api/showcase").json()] == [c, a, b]


def test_reorder_with_stale_list_keeps_unlisted_photos(logged_in_client):
    a, b, c = _three(logged_in_client)
    resp = logged_in_client.post("/admin/api/showcase/reorder", json={"orderedIds": [c]})
    assert resp.status_code == 200
    assert [i["id"] for i in resp.json()] == [c, a, b]


def test_reorder_rejects_unknown_and_duplicate_ids(logged_in_client):
    a, b, _c = _three(logged_in_client)
    assert logged_in_client.post("/admin/api/showcase/reorder", json={"orderedIds": [a, "nope"]}).status_code == 400
    assert logged_in_client.post("/admin/api/showcase/reorder", json={"orderedIds": [a, a]}).status_code == 400
    # A rejected reorder changes nothing.
    assert [i["id"] for i in logged_in_client.get("/admin/api/showcase").json()][:2] == [a, b]


def test_new_upload_after_delete_goes_to_the_end(logged_in_client):
    a, b, c = _three(logged_in_client)
    logged_in_client.delete(f"/admin/api/showcase/{a}").raise_for_status()
    new = _upload(logged_in_client, ("d.png", _png(9)))["created"][0]
    assert [i["id"] for i in logged_in_client.get("/admin/api/showcase").json()] == [b, c, new["id"]]


def test_delete_removes_row_and_file(client, logged_in_client, tmp_path):
    created = _upload(logged_in_client, ("a.png", _png(6)), ("b.png", _png(7)))["created"]
    doomed, kept = created
    doomed_file = tmp_path / doomed["url"].removeprefix("/uploads/")
    assert doomed_file.exists()

    resp = logged_in_client.delete(f"/admin/api/showcase/{doomed['id']}")
    assert resp.status_code == 200
    assert not doomed_file.exists()
    assert (tmp_path / kept["url"].removeprefix("/uploads/")).exists()
    assert [i["id"] for i in client.get("/api/showcase").json()] == [kept["id"]]

    assert logged_in_client.delete(f"/admin/api/showcase/{doomed['id']}").status_code == 404


def test_remove_file_refuses_paths_outside_uploads(tmp_path):
    outside = tmp_path.parent / "keep-me.txt"
    outside.write_text("important")
    showcase_service.remove_file("../keep-me.txt")
    showcase_service.remove_file("/etc/hostname")
    assert outside.exists()
    outside.unlink()


# --- auth --------------------------------------------------------------

def test_admin_showcase_endpoints_require_login(client):
    assert client.get("/admin/api/showcase").status_code == 401
    assert client.post("/admin/api/showcase", files=_files(("a.png", _png()))).status_code == 401
    assert client.patch("/admin/api/showcase/x", json={"caption": "hi"}).status_code == 401
    assert client.delete("/admin/api/showcase/x").status_code == 401
    assert client.post("/admin/api/showcase/reorder", json={"orderedIds": []}).status_code == 401


def test_state_changing_showcase_calls_require_csrf(logged_in_client, tmp_path):
    bad = {"X-CSRF-Token": "wrong"}
    resp = logged_in_client.post("/admin/api/showcase", files=_files(("a.png", _png())), headers=bad)
    assert resp.status_code == 403
    assert list(tmp_path.iterdir()) == []
    assert logged_in_client.delete("/admin/api/showcase/x", headers=bad).status_code == 403
