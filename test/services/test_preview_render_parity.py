import json
import os
import unittest

import numpy as np
import pytest

pytest.importorskip("moviepy")
from moviepy import ColorClip, CompositeVideoClip

from app.services import video
from app.services.quality.subtitle_styles import SubtitleRenderSettings
from app.utils import utils

# 9:16 at a small scale (bands are proportional); keep the 1080:1920 ratio.
WIDTH, HEIGHT = 270, 480
BG_RGB = (128, 128, 128)
ITEM = ((0.0, 2.0), "Texto de prueba")
FONT_PATH = os.path.join(utils.font_dir(), "UTM Kabel KT.ttf")
FIXTURES = os.path.join(
    utils.root_dir(),
    "webui-react",
    "src",
    "lib",
    "__fixtures__",
    "subtitlePreviewParity.json",
)


def _style(fx):
    s = fx["style"]
    return SubtitleRenderSettings(
        font_size=int(s["fontSize"] * HEIGHT / 1920),  # scale to the small frame
        stroke_width=float(s.get("strokeWidth", 1.5)),
        stroke_color="#000000",
        fore_color="#FFFFFF",
        background_color=s.get("backgroundColor", True),
        rounded_background=bool(s.get("roundedBackground", False)),
        position=s["position"],
        custom_position=float(s.get("customPosition", 70.0)),
        normalize=False,
        word_highlight=False,
    )


def _frame(style):
    clip = video.build_subtitle_text_clip(style, ITEM, FONT_PATH, WIDTH, HEIGHT)
    bg = ColorClip(size=(WIDTH, HEIGHT), color=BG_RGB).with_duration(2.0)
    return np.asarray(
        CompositeVideoClip([bg, clip], size=(WIDTH, HEIGHT)).get_frame(1.0)
    ).astype("int16")


def _centroid(frame):
    mask = np.abs(frame - np.array(BG_RGB)).sum(axis=2) > 40
    rows = np.where(mask.any(axis=1))[0]
    return (
        None
        if rows.size == 0
        else (rows.min() + rows.max()) / 2 / frame.shape[0]
    )


@unittest.skipUnless(os.path.exists(FONT_PATH), "bundled font missing")
class PreviewRenderParityTest(unittest.TestCase):
    def test_render_matches_fixture_band_and_background(self):
        with open(FIXTURES, encoding="utf-8") as fp:
            fixtures = json.load(fp)
        for fx in fixtures:
            frame = _frame(_style(fx))
            centroid = _centroid(frame)
            self.assertIsNotNone(centroid, fx["name"])
            if fx["band"] == "bottom":
                self.assertGreater(centroid, 0.6, fx["name"])
            elif fx["band"] == "top":
                self.assertLess(centroid, 0.4, fx["name"])
            else:
                self.assertGreater(centroid, 0.4, fx["name"])
                self.assertLess(centroid, 0.6, fx["name"])

            # Background presence: a filled box adds many dark pixels vs stroke-only.
            dark = int((frame.sum(axis=2) < 180).sum())
            if fx["hasBackground"]:
                self.assertGreater(dark, 300, fx["name"])
            else:
                self.assertLess(dark, 1000, fx["name"])
