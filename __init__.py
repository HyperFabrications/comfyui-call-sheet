"""Call Sheet, a Krea 2 shot builder for ComfyUI: a sidebar of Krea 2 pose prompts plus nodes that output them."""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from . import thumbs  # noqa: F401  (registers the preview image routes)
from . import custom  # noqa: F401  (registers the Custom tab routes)
from . import places  # noqa: F401  (registers the custom places routes)
from . import outfit_items  # noqa: F401  (registers the custom clothing routes)
from . import choices  # noqa: F401  (registers the Studio choices routes)

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
