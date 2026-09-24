"""add page_image table

Revision ID: 2ecb3176d548
Revises: 4e4cf3777012
Create Date: 2026-09-24 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ecb3176d548'
down_revision: Union[str, None] = '4e4cf3777012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('page_image',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('page_slug', sa.String(length=48), nullable=False),
    sa.Column('filename', sa.String(length=64), nullable=False),
    sa.Column('caption', sa.String(length=200), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_by', sa.String(length=32), nullable=True),
    sa.ForeignKeyConstraint(['page_slug'], ['content_page.slug'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['updated_by'], ['admin_user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_page_image_slug_active_position', 'page_image', ['page_slug', 'is_active', 'position'], unique=False)
    op.create_index(op.f('ix_page_image_page_slug'), 'page_image', ['page_slug'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_page_image_page_slug'), table_name='page_image')
    op.drop_index('ix_page_image_slug_active_position', table_name='page_image')
    op.drop_table('page_image')
