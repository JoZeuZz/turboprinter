import os
import unittest

import pytest

pytest.importorskip("moviepy")

from app.services import video
from app.services.quality.subtitle_styles import SubtitleRenderSettings
from app.utils import utils

FONT_PATH = os.path.join(utils.font_dir(), "UTM Kabel KT.ttf")


def _style(**over):
    base = dict(
        font_size=60,
        stroke_width=1.5,
        stroke_color="#000000",
        fore_color="#FFFFFF",
        background_color=True,
        rounded_background=False,
        position="bottom",
        custom_position=70.0,
        normalize=False,
        word_highlight=False,
    )
    base.update(over)
    return SubtitleRenderSettings(**base)


@unittest.skipUnless(os.path.exists(FONT_PATH), "bundled font missing")
class BuildSubtitleClipTest(unittest.TestCase):
    def test_returns_positioned_clip(self):
        item = ((0.0, 2.0), "Texto de prueba")
        clip = video.build_subtitle_text_clip(
            _style(), item, FONT_PATH, 320, 568
        )
        self.assertIsNotNone(clip)
        self.assertGreater(clip.h, 0)
        # positioned by _position_subtitle_clip -> has a pos attribute set
        self.assertIsNotNone(getattr(clip, "pos", None))

    def test_background_color_helper_bool_and_string(self):
        self.assertIsNone(
            video._resolve_subtitle_background_color(_style(background_color=False))
        )
        self.assertEqual(
            "#000000",
            video._resolve_subtitle_background_color(_style(background_color=True)),
        )
        self.assertEqual(
            "#123456",
            video._resolve_subtitle_background_color(
                _style(background_color="#123456")
            ),
        )
