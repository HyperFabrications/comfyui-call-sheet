"""Krea Pose Sheet for ComfyUI: a sidebar of Krea 2 pose prompts plus nodes that output them."""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from . import thumbs  # noqa: F401  (registers the preview image routes)
from . import custom  # noqa: F401  (registers the Custom tab routes)

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
