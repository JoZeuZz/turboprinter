import os
import unittest

import numpy as np
import pytest

pytest.importorskip("moviepy")
from moviepy import ColorClip, CompositeVideoClip

from app.services import video
from app.services.quality.subtitle_styles import SubtitleRenderSettings
from app.utils import utils

WIDTH, HEIGHT = 320, 568
BG_RGB = (128, 128, 128)
ITEM = ((0.0, 2.0), "Texto de prueba")
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


def _render_frame(style):
    clip = video.build_subtitle_text_clip(style, ITEM, FONT_PATH, WIDTH, HEIGHT)
    bg = ColorClip(size=(WIDTH, HEIGHT), color=BG_RGB).with_duration(2.0)
    comp = CompositeVideoClip([bg, clip], size=(WIDTH, HEIGHT))
    return np.asarray(comp.get_frame(1.0)).astype("int16")


def _foreground_mask(frame, tol=40):
    # pixels that differ from the gray background beyond tolerance
    diff = np.abs(frame - np.array(BG_RGB)).sum(axis=2)
    return diff > tol


def _vertical_centroid(mask):
    rows = np.where(mask.any(axis=1))[0]
    if rows.size == 0:
        return None
    return float((rows.min() + rows.max()) / 2 / mask.shape[0])


def _count_color(frame, rgb, tol=60):
    diff = np.abs(frame - np.array(rgb)).sum(axis=2)
    return int((diff < tol).sum())


@unittest.skipUnless(os.path.exists(FONT_PATH), "bundled font missing")
class SubtitleRenderPixelTest(unittest.TestCase):
    def test_bottom_solid_background(self):
        frame = _render_frame(_style(position="bottom", background_color=True))
        mask = _foreground_mask(frame)
        # (a) white text pixels present
        self.assertGreater(_count_color(frame, (255, 255, 255)), 50)
        # (b) subtitle sits in the lower third
        self.assertGreater(_vertical_centroid(mask), 0.6)
        # (c) a filled dark box is present behind the text
        self.assertGreater(_count_color(frame, (0, 0, 0)), 400)

    def test_top_no_background(self):
        frame = _render_frame(
            _style(position="top", background_color=False)
        )
        mask = _foreground_mask(frame)
        # (a) text present
        self.assertGreater(_count_color(frame, (255, 255, 255)), 50)
        # (b) subtitle sits in the upper third
        self.assertLess(_vertical_centroid(mask), 0.4)
        # (c) no filled box: dark pixels are just the bold stroke outline
        # (bundled font UTM Kabel KT is chunky; its stroke alone yields
        # ~5.7k near-black px, vs ~66k for an actual opaque box - confirmed
        # via manual frame inspection, see task-2-report.md)
        self.assertLess(_count_color(frame, (0, 0, 0)), 20000)

    def test_center_rounded_background(self):
        frame = _render_frame(
            _style(position="center", background_color=True, rounded_background=True)
        )
        mask = _foreground_mask(frame)
        centroid = _vertical_centroid(mask)
        # (b) centered band
        self.assertGreater(centroid, 0.4)
        self.assertLess(centroid, 0.6)
        # (c) background box present. The rounded box is rendered
        # semi-transparent (alpha=140, see
        # app/services/video.py:_rounded_subtitle_background_clip), so over
        # the BG_RGB=(128,128,128) test background it composites to a flat
        # ~(58,58,58) fill, not pure black - checking for (0, 0, 0) here
        # would only catch stroke anti-aliasing (~6k px, indistinguishable
        # from the no-box case) and never actually detect the box.
        rounded_box_fill = tuple(
            round(c * (255 - 140) / 255) for c in BG_RGB
        )
        self.assertGreater(_count_color(frame, rounded_box_fill, tol=30), 5000)

    def test_custom_position_and_color(self):
        frame = _render_frame(
            _style(
                position="custom",
                custom_position=30.0,
                fore_color="#FFDD00",
                background_color=False,
            )
        )
        mask = _foreground_mask(frame)
        # (a) requested color rendered (catches color-mapping regression)
        self.assertGreater(_count_color(frame, (255, 221, 0), tol=80), 50)
        # (b) near the 30% band (loose tolerance)
        self.assertAlmostEqual(_vertical_centroid(mask), 0.30, delta=0.15)
