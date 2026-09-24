"""add product image and datasheet columns

Revision ID: 4e4cf3777012
Revises: 7f9173861630
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e4cf3777012'
down_revision: Union[str, None] = '7f9173861630'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('product', sa.Column('image_url', sa.String(length=500), nullable=True))
    op.add_column('product', sa.Column('datasheet_url', sa.String(length=500), nullable=True))
    op.add_column('product', sa.Column('datasheet_filename', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('product', 'datasheet_filename')
    op.drop_column('product', 'datasheet_url')
    op.drop_column('product', 'image_url')
