import unittest
import os
import shutil
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

# add project root to python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services import task as tm
from app.models.schema import MaterialInfo, VideoParams
from app.utils import utils

resources_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "resources")
RUN_INTEGRATION_TESTS = os.environ.get("MPT_RUN_INTEGRATION_TESTS", "").lower() in {
    "1",
    "true",
    "yes",
}

class TestTaskService(unittest.TestCase):
    def setUp(self):
        pass
    
    def tearDown(self):
        pass

    def test_generate_script_forwards_advanced_prompt_options(self):
        """
        任务生成入口和 WebUI/API 共用 VideoParams。这里验证自动生成文案时，
        高级提示词参数会继续传到 LLM 服务层，避免只在 /scripts 接口生效。
        """
        params = VideoParams(
            video_subject="咖啡",
            video_script="",
            video_language="zh-CN",
            paragraph_number=2,
            video_script_prompt="语气轻松",
            custom_system_prompt="Only write short narration.",
        )

        with patch.object(tm.llm, "generate_script", return_value="生成的文案") as generate:
            result = tm.generate_script("task-id", params)

        self.assertEqual(result, "生成的文案")
        generate.assert_called_once_with(
            video_subject="咖啡",
            language="zh-CN",
            paragraph_number=2,
            video_script_prompt="语气轻松",
            custom_system_prompt="Only write short narration.",
        )

    def test_generate_terms_uses_script_order_mode_when_enabled(self):
        """
        默认模式不受影响；只有用户显式开启素材按文案顺序匹配时，任务层才
        要求 LLM 生成有序关键词，并适当增加关键词数量以覆盖更多脚本片段。
        """
        params = VideoParams(
            video_subject="城市通勤",
            video_script="",
            match_materials_to_script=True,
        )

        with patch.object(tm.llm, "generate_terms", return_value=["city", "train"]) as generate:
            result = tm.generate_terms("task-id", params, "先城市，再地铁")

        self.assertEqual(result, ["city", "train"])
        generate.assert_called_once_with(
            video_subject="城市通勤",
            video_script="先城市，再地铁",
            amount=8,
            match_script_order=True,
        )

    def test_generate_terms_returns_none_when_llm_returns_error_string(self):
        """generate_terms must fail cleanly when LLM returns 'Error: ...' string."""
        from unittest.mock import MagicMock
        params = VideoParams(video_subject="test", video_script="")

        with patch.object(tm.llm, "generate_terms", return_value="Error: api_key is not set"), \
             patch.object(tm.sm.state, "update_task") as update_task:
            result = tm.generate_terms("task-err", params, "script text")

        self.assertIsNone(result)
        update_task.assert_called_with("task-err", state=tm.const.TASK_STATE_FAILED)
    
    def test_generate_audio_uses_custom_file_inside_task_directory(self):
        task_id = "test-custom-audio-safe"
        task_dir = utils.task_dir(task_id)
        custom_audio_file = os.path.join(task_dir, "custom-audio.mp3")
        with open(custom_audio_file, "wb") as audio:
            audio.write(b"fake audio")

        params = VideoParams(
            video_subject="custom audio",
            video_script="",
            custom_audio_file=custom_audio_file,
            voice_name="test-voice",
        )

        try:
            with (
                patch.object(tm.voice, "tts") as tts,
                patch.object(tm.voice, "get_audio_duration", return_value=7),
            ):
                audio_file, audio_duration, sub_maker = tm.generate_audio(
                    task_id, params, "script"
                )
        finally:
            shutil.rmtree(task_dir, ignore_errors=True)

        self.assertEqual(audio_file, os.path.realpath(custom_audio_file))
        self.assertEqual(audio_duration, 7)
        self.assertIsNone(sub_maker)
        tts.assert_not_called()

    def test_resolve_custom_audio_accepts_server_side_for_cli(self):
        """Server-side paths are allowed when restrict_to_task_dir=False (CLI mode)."""
        task_id = "test-custom-audio-server-side"
        task_dir = utils.task_dir(task_id)
        with tempfile.NamedTemporaryFile(suffix=".mp3") as server_audio:
            server_audio.write(b"fake audio")
            server_audio.flush()
            result = tm.resolve_custom_audio_file(
                task_id,
                server_audio.name,
                restrict_to_task_dir=False,
            )
        shutil.rmtree(task_dir, ignore_errors=True)
        self.assertEqual(result, os.path.realpath(server_audio.name))

    def test_resolve_custom_audio_rejects_server_side_for_api(self):
        """Server-side paths are rejected when restrict_to_task_dir=True (API mode)."""
        task_id = "test-custom-audio-api-restrict"
        task_dir = utils.task_dir(task_id)
        with tempfile.NamedTemporaryFile(suffix=".mp3") as server_audio:
            server_audio.write(b"fake audio")
            server_audio.flush()
            with self.assertRaises(ValueError):
                tm.resolve_custom_audio_file(
                    task_id,
                    server_audio.name,
                    restrict_to_task_dir=True,
                )
        shutil.rmtree(task_dir, ignore_errors=True)

    def test_generate_audio_rejects_missing_custom_file_without_tts(self):
        task_id = "test-custom-audio-missing"
        task_dir = utils.task_dir(task_id)
        missing_audio_file = os.path.join(task_dir, "missing.mp3")
        params = VideoParams(
            video_subject="custom audio",
            video_script="",
            custom_audio_file=missing_audio_file,
            voice_name="test-voice",
        )

        try:
            with (
                patch.object(tm.voice, "tts") as tts,
                patch.object(tm.sm.state, "update_task") as update_task,
            ):
                audio_file, audio_duration, result_sub_maker = tm.generate_audio(
                    task_id, params, "script"
                )
        finally:
            shutil.rmtree(task_dir, ignore_errors=True)

        self.assertIsNone(audio_file)
        self.assertIsNone(audio_duration)
        self.assertIsNone(result_sub_maker)
        tts.assert_not_called()
        update_task.assert_called_with(task_id, state=tm.const.TASK_STATE_FAILED)

    def test_generate_audio_threads_restrict_custom_audio_flag(self):
        """
        generate_audio must forward restrict_custom_audio to resolve_custom_audio_file.

        - restrict_custom_audio=False (CLI/WebUI default): server-side .mp3 outside
          the task dir is resolved and returned directly (no TTS, no FAILED state).
        - restrict_custom_audio=True (API default): same path is rejected, task is
          marked FAILED, and (None, None, None) is returned.
        """
        task_id_allow = "test-thread-restrict-allow"
        task_id_deny = "test-thread-restrict-deny"
        task_dir_allow = utils.task_dir(task_id_allow)
        task_dir_deny = utils.task_dir(task_id_deny)

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as server_audio:
            server_audio.write(b"fake server audio")
            server_audio_path = server_audio.name

        try:
            # --- permissive path (CLI) ---
            params_allow = VideoParams(
                video_subject="test",
                video_script="",
                custom_audio_file=server_audio_path,
                voice_name="test-voice",
            )
            with (
                patch.object(tm.voice, "tts") as tts_allow,
                patch.object(tm.voice, "get_audio_duration", return_value=5),
            ):
                audio_file, audio_duration, sub_maker = tm.generate_audio(
                    task_id_allow, params_allow, "script", restrict_custom_audio=False
                )

            self.assertEqual(audio_file, os.path.realpath(server_audio_path))
            self.assertEqual(audio_duration, 5)
            self.assertIsNone(sub_maker)
            tts_allow.assert_not_called()

            # --- restrictive path (API) ---
            params_deny = VideoParams(
                video_subject="test",
                video_script="",
                custom_audio_file=server_audio_path,
                voice_name="test-voice",
            )
            with (
                patch.object(tm.voice, "tts") as tts_deny,
                patch.object(tm.sm.state, "update_task") as update_task,
            ):
                audio_file2, audio_duration2, sub_maker2 = tm.generate_audio(
                    task_id_deny, params_deny, "script", restrict_custom_audio=True
                )

            self.assertIsNone(audio_file2)
            self.assertIsNone(audio_duration2)
            self.assertIsNone(sub_maker2)
            tts_deny.assert_not_called()
            update_task.assert_called_with(task_id_deny, state=tm.const.TASK_STATE_FAILED)

        finally:
            os.unlink(server_audio_path)
            shutil.rmtree(task_dir_allow, ignore_errors=True)
            shutil.rmtree(task_dir_deny, ignore_errors=True)

    def test_save_script_data_writes_to_meta_subdir(self):
        task_id = "test-script-meta"
        task_dir = utils.task_dir(task_id)
        try:
            tm.save_script_data(task_id, "test script", ["term1"], {})
            expected = os.path.join(task_dir, "_meta", "script.json")
            self.assertTrue(os.path.exists(expected), f"script.json not found at {expected}")
        finally:
            shutil.rmtree(task_dir, ignore_errors=True)

    @unittest.skipUnless(
        RUN_INTEGRATION_TESTS,
        "MPT_RUN_INTEGRATION_TESTS not set",
    )
    def test_task_local_materials(self):
        task_id = "00000000-0000-0000-0000-000000000000"
        video_materials=[]
        for i in range(1, 4):
            video_materials.append(MaterialInfo(
                provider="local",
                url=os.path.join(resources_dir, f"{i}.png"),
                duration=0
            ))

        params = VideoParams(
            video_subject="金钱的作用",
            video_script="金钱不仅是交换媒介，更是社会资源的分配工具。它能满足基本生存需求，如食物和住房，也能提供教育、医疗等提升生活品质的机会。拥有足够的金钱意味着更多选择权，比如职业自由或创业可能。但金钱的作用也有边界，它无法直接购买幸福、健康或真诚的人际关系。过度追逐财富可能导致价值观扭曲，忽视精神层面的需求。理想的状态是理性看待金钱，将其作为实现目标的工具而非终极目的。",
            video_terms="money importance, wealth and society, financial freedom, money and happiness, role of money",
            video_aspect="9:16",
            video_concat_mode="random",
            video_transition_mode="None",
            video_clip_duration=3,
            video_count=1,
            video_source="local",
            video_materials=video_materials,
            video_language="",
            voice_name="zh-CN-XiaoxiaoNeural-Female",
            voice_volume=1.0,
            voice_rate=1.0,
            bgm_type="random",
            bgm_file="",
            bgm_volume=0.2,
            subtitle_enabled=True,
            subtitle_position="bottom",
            custom_position=70.0,
            font_name="MicrosoftYaHeiBold.ttc",
            text_fore_color="#FFFFFF",
            text_background_color=True,
            font_size=60,
            stroke_color="#000000",
            stroke_width=1.5,
            n_threads=2,
            paragraph_number=1
        )
        result = tm.start(task_id=task_id, params=params)
        print(result)
    

if __name__ == "__main__":
    unittest.main()
