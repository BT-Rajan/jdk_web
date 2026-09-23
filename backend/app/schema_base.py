"""
Shared Pydantic base for API request/response models: fields are declared
snake_case (Python convention) but serialize/parse as camelCase (JS
convention) on the wire, via a model-level alias_generator instead of a
hand-written alias per field. `populate_by_name=True` means the model can
still be constructed with the Python (snake_case) names internally —
only the HTTP boundary sees camelCase.

Scope: this converts *declared model fields* (fixed API object shapes —
PageOut.is_visible, VersionOut.saved_by_username, etc). It does NOT touch
free-form dict payloads (settings-registry values, content translations)
— those dicts' keys are camelCased directly at the source (see
settings_registry.py / content_schema.py), not through this mechanism,
since there's no fixed Pydantic field list to attach an alias to.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
