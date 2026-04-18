"""AI recommendation service with multimodal and text-only fallbacks.

If an OpenAI-compatible endpoint is configured and the model supports image
input, the service sends the uploaded plant image together with recognition
context for image-grounded analysis. If image input is unsupported, it falls
back to text-only advice based on the local prediction output. When no remote
service is available, deterministic builtin advice keeps the API stable.
"""

import base64
import io
import json
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib import error, request
from urllib.parse import urljoin

from PIL import Image

try:
    from .config import settings
except ImportError:
    from config import settings

LOCAL_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
LOCAL_OLLAMA_TAGS_URL = f"{LOCAL_OLLAMA_BASE_URL}/api/tags"
LOCAL_OLLAMA_CHAT_URL = f"{LOCAL_OLLAMA_BASE_URL}/v1/chat/completions"

_CLASS_KNOWLEDGE_ADVICE_PACKS: Dict[str, List[str]] = {
    "apple_leaf": [
        "继续保持果园通风透光，减少高湿环境持续时间。",
        "定期巡查新梢和中下部叶片，尽早发现早期病斑。",
        "维持清园和落叶管理，降低后续病害发生风险。",
    ],
    "apple_scab_leaf": [
        "及时清理病叶和落叶，减少病源残留。",
        "保持果园通风，避免高湿环境持续。",
        "在发病初期按说明使用针对性杀菌剂。",
    ],
    "apple_rust_leaf": [
        "移除病叶，降低病原传播机会。",
        "加强通风和光照管理。",
        "在病害初期采取针对性药剂防治。",
    ],
    "bell_pepper_leaf_spot": [
        "避免叶面长期积水。",
        "及时摘除严重病叶。",
        "合理轮作并做好病害预防。",
    ],
    "bell_pepper_leaf": [
        "控制棚内湿度，避免叶面长时间挂水。",
        "保持株间通风，减少病害滋生条件。",
        "持续巡查中下部叶片，发现异常及时处理。",
    ],
    "blueberry_leaf": [
        "维持适宜湿度和通风条件，避免连续闷湿。",
        "巡查叶片边缘和叶背，关注是否有早期病斑或虫口。",
        "结合修剪和清园管理，减少后续病虫害积累。",
    ],
    "cherry_leaf": [
        "重点观察新叶和外围叶片，尽早发现斑点或卷叶问题。",
        "控制园内湿度并保持透光，降低叶部病害发生几率。",
        "结合清园管理，减少枝叶残体带来的后续风险。",
    ],
    "corn_gray_leaf_spot": [
        "控制种植密度，改善田间通风。",
        "发病后清除病残体。",
        "必要时使用适合玉米的杀菌措施。",
    ],
    "soybean_leaf": [
        "巡查叶背和嫩叶，及时发现早期虫害或斑点。",
        "避免田间郁闭和长期潮湿，降低病害压力。",
        "维持清园和轮作管理，减少后续病虫害积累。",
    ],
    "corn_leaf_blight": [
        "及时清理病叶和残株。",
        "合理施肥，增强植株抗病力。",
        "根据田间情况采取药剂防治。",
    ],
    "corn_rust_leaf": [
        "加强田间巡查，及早处理病叶。",
        "避免偏施氮肥。",
        "在高发期提前做好病害预防。",
    ],
    "potato_leaf_early_blight": [
        "及时清除病叶和病株。",
        "避免长期高湿和积水。",
        "轮作种植并做好杀菌管理。",
    ],
    "potato_leaf": [
        "重点观察中下部叶片是否出现轮纹斑或水渍状病斑。",
        "避免垄间积水和长期高湿，减少病害诱发条件。",
        "结合轮作和清园措施，持续保持田间卫生。",
    ],
    "potato_leaf_late_blight": [
        "发现后尽快隔离严重病株。",
        "减少田间湿度和积水。",
        "及时采取针对性防治措施。",
    ],
    "peach_leaf": [
        "持续巡查嫩梢和新叶，观察是否出现斑点、卷曲或穿孔。",
        "保持修剪和通风透光，降低叶部病害条件。",
        "结合清园管理，减少病残枝叶累积。",
    ],
    "raspberry_leaf": [
        "巡查叶背与新梢，留意虫口和早期病斑。",
        "避免郁闭和高湿，减少叶部病害滋生条件。",
        "结合修剪与清园，维持植株健康状态。",
    ],
    "strawberry_leaf": [
        "保持通风透光，避免棚内高湿持续。",
        "巡查叶片边缘和背面，尽早发现病斑或虫口。",
        "及时清除老叶和病残体，降低后续病害压力。",
    ],
    "tomato_leaf": [
        "保持棚内通风并减少叶面长期潮湿。",
        "持续巡查新叶和中下部叶片，发现卷叶、花叶或水渍斑时及时处理。",
        "结合白粉虱等媒介虫监测，提前预防病毒和叶部病害。",
    ],
    "squash_powdery_mildew_leaf": [
        "及时清理病叶。",
        "改善通风和透光条件。",
        "必要时喷施针对白粉病的药剂。",
    ],
    "tomato_early_blight_leaf": [
        "及时摘除病叶。",
        "避免叶片长期潮湿。",
        "发病初期及时处理，防止扩展。",
    ],
    "tomato_septoria_leaf_spot": [
        "减少叶面喷水。",
        "及时清除病叶残体。",
        "做好轮作和病害预防。",
    ],
    "tomato_leaf_bacterial_spot": [
        "避免机械损伤和雨后操作。",
        "加强种苗卫生管理。",
        "及时清除病残体并注意防护。",
    ],
    "tomato_leaf_late_blight": [
        "发现早期症状后尽快处理。",
        "降低湿度并加强通风。",
        "重病植株及时隔离。",
    ],
    "tomato_leaf_mosaic_virus": [
        "及时移除疑似病株。",
        "工具消毒，减少接触传播。",
        "加强媒介昆虫防控。",
    ],
    "tomato_leaf_yellow_virus": [
        "优先控制白粉虱等传播媒介。",
        "及时清理病株，防止扩散。",
        "加强田间卫生和隔离管理。",
    ],
    "tomato_mold_leaf": [
        "降低棚内湿度。",
        "保证通风换气。",
        "发病初期及时采取处理措施。",
    ],
    "tomato_two_spotted_spider_mites_leaf": [
        "重点检查叶片背面虫害。",
        "清除受害严重叶片。",
        "根据情况采取螨类防治措施。",
    ],
    "grape_leaf": [
        "定期巡查叶片和果穗周边，尽早发现褐斑或坏死点。",
        "加强修剪与通风透光，减少高湿环境持续。",
        "及时清理落果和病残体，降低病原积累。",
    ],
    "grape_leaf_black_rot": [
        "及时清除病残枝叶和落果。",
        "加强果园通风透光。",
        "发病季节做好预防性管理。",
    ],
    "profile_rust": [
        "优先巡查发病叶片和周边植株，尽快摘除病叶并减少二次传播。",
        "控制种植密度并改善通风透光，避免叶面长时间潮湿。",
        "结合当地作物保护建议，在高发阶段尽早采取针对性防治措施。",
    ],
    "profile_spot": [
        "先确认病斑范围和扩展速度，及时清除受害严重的叶片或残体。",
        "减少叶面喷水和长期积水，尽量让种植环境保持通风干爽。",
        "结合轮作、田间卫生和针对性防治手段，降低后续复发风险。",
    ],
    "profile_blight": [
        "发现疑似病叶后尽快隔离重病部位，减少在高湿条件下继续扩散。",
        "重点降低棚内或田间湿度，避免连片积水和过密种植。",
        "结合病程进展及时采取针对性防治方案，并连续观察 3 到 5 天。",
    ],
    "profile_mildew": [
        "尽快清除叶面霉层明显或白粉较重的叶片，减轻病源压力。",
        "加强通风、透光和湿度管理，避免叶面长时间保持潮湿。",
        "在发病初期结合适宜药剂或栽培措施同步处理，防止快速蔓延。",
    ],
    "profile_virus": [
        "及时标记并清除疑似病株，减少持续传染源。",
        "加强工具消毒和田间卫生管理，避免人为接触传播。",
        "重点监测并控制白粉虱、蚜虫等传播媒介，降低新发概率。",
    ],
    "profile_mite": [
        "重点检查叶片背面和新梢部位，及时清除受害严重的叶片。",
        "通过控温控湿和清洁管理减少虫害滋生环境。",
        "根据虫口密度选择针对螨类的防治方案，并连续复查虫口变化。",
    ],
    "profile_insect": [
        "优先检查嫩叶、叶背和生长点，及时处理虫口集中区域。",
        "结合诱捕、清园和环境管理压低虫源基数。",
        "根据虫害类型选择对应防治措施，并持续观察 3 到 5 天效果。",
    ],
    "profile_rot": [
        "及时清除病残叶、病果或病枝，减少病原继续扩散。",
        "避免高湿、积水和机械损伤，降低腐烂类病害加重的条件。",
        "结合清园和针对性防治方案，尽快完成一轮处置并复查新病斑。",
    ],
}

_EXACT_CLASS_KNOWLEDGE: Dict[str, Dict[str, object]] = {
    "apple leaf": {
        "summary": "当前类别更接近苹果健康叶片，建议继续保持通风、清园和常规巡查，重点观察是否出现新病斑。",
        "advice_key": "apple_leaf",
    },
    "apple scab leaf": {
        "summary": "苹果黑星病会导致叶片出现暗色病斑，严重时会影响叶片光合作用和果实品质。",
        "advice_key": "apple_scab_leaf",
    },
    "apple rust leaf": {
        "summary": "苹果锈病常表现为叶片橙黄色病斑，扩展后会影响叶片正常生长。",
        "advice_key": "apple_rust_leaf",
    },
    "bell pepper leaf spot": {
        "summary": "甜椒叶斑病会在叶片形成斑点和坏死区域，影响植株长势。",
        "advice_key": "bell_pepper_leaf_spot",
    },
    "bell pepper leaf": {
        "summary": "当前类别更接近甜椒健康叶片，建议以环境稳定和日常巡查为主，持续观察是否有新斑点出现。",
        "advice_key": "bell_pepper_leaf",
    },
    "bell_pepper leaf spot": {"alias_of": "bell pepper leaf spot"},
    "bell_pepper leaf": {"alias_of": "bell pepper leaf"},
    "blueberry leaf": {
        "summary": "当前类别更接近蓝莓健康叶片，建议保持水肥和通风稳定，并继续观察叶面是否出现异常变色。",
        "advice_key": "blueberry_leaf",
    },
    "cherry leaf": {
        "summary": "当前类别更接近樱桃健康叶片，建议继续做好通风、清园和规律巡查。",
        "advice_key": "cherry_leaf",
    },
    "corn gray leaf spot": {
        "summary": "玉米灰斑病会形成灰褐色长条状病斑，严重时会降低产量。",
        "advice_key": "corn_gray_leaf_spot",
    },
    "soyabean leaf": {
        "summary": "当前类别更接近大豆健康叶片，建议继续做好田间通风、清洁和虫情巡查。",
        "advice_key": "soybean_leaf",
    },
    "soybean leaf": {"alias_of": "soyabean leaf"},
    "corn leaf blight": {
        "summary": "玉米叶枯病会导致叶片干枯、病斑扩展，影响光合作用。",
        "advice_key": "corn_leaf_blight",
    },
    "corn rust leaf": {
        "summary": "玉米锈病常见橙褐色孢子堆，严重时会削弱植株生长。",
        "advice_key": "corn_rust_leaf",
    },
    "potato leaf early blight": {
        "summary": "马铃薯早疫病会在叶片形成同心轮纹病斑，影响叶片功能。",
        "advice_key": "potato_leaf_early_blight",
    },
    "potato leaf": {
        "summary": "当前类别更接近马铃薯健康叶片，建议继续保持田间通风、排水和病斑巡查。",
        "advice_key": "potato_leaf",
    },
    "potato leaf late blight": {
        "summary": "马铃薯晚疫病扩展快、危害重，叶片会迅速坏死。",
        "advice_key": "potato_leaf_late_blight",
    },
    "peach leaf": {
        "summary": "当前类别更接近桃树健康叶片，建议继续以园内通风和病斑巡查为主。",
        "advice_key": "peach_leaf",
    },
    "raspberry leaf": {
        "summary": "当前类别更接近覆盆子健康叶片，建议继续保持通风和病虫巡查。",
        "advice_key": "raspberry_leaf",
    },
    "strawberry leaf": {
        "summary": "当前类别更接近草莓健康叶片，建议继续关注棚内湿度和病斑巡查，预防叶部病害反复。",
        "advice_key": "strawberry_leaf",
    },
    "tomato leaf": {
        "summary": "当前类别更接近番茄健康叶片，建议继续做好通风、控湿和叶面巡查，重点预防早晚疫病与病毒类问题。",
        "advice_key": "tomato_leaf",
    },
    "squash powdery mildew leaf": {
        "summary": "白粉病会在叶片表面形成白色粉状层，影响植株养分积累。",
        "advice_key": "squash_powdery_mildew_leaf",
    },
    "tomato early blight leaf": {
        "summary": "番茄早疫病常见褐色轮纹病斑，严重时会导致叶片提前脱落。",
        "advice_key": "tomato_early_blight_leaf",
    },
    "tomato septoria leaf spot": {
        "summary": "番茄斑点病会造成密集小斑点，影响叶片活力。",
        "advice_key": "tomato_septoria_leaf_spot",
    },
    "tomato leaf bacterial spot": {
        "summary": "番茄细菌性斑点病会导致小型水渍状病斑，严重时叶片发黄。",
        "advice_key": "tomato_leaf_bacterial_spot",
    },
    "tomato leaf late blight": {
        "summary": "番茄晚疫病扩展迅速，叶片常出现大面积水渍状坏死。",
        "advice_key": "tomato_leaf_late_blight",
    },
    "tomato leaf mosaic virus": {
        "summary": "番茄花叶病毒病常造成叶片斑驳、皱缩和长势减弱。",
        "advice_key": "tomato_leaf_mosaic_virus",
    },
    "tomato leaf yellow virus": {
        "summary": "番茄黄化病毒病会引起叶片发黄卷曲，影响开花结果。",
        "advice_key": "tomato_leaf_yellow_virus",
    },
    "tomato mold leaf": {
        "summary": "番茄霉叶病多在高湿环境下发生，叶片背面常见霉层。",
        "advice_key": "tomato_mold_leaf",
    },
    "tomato two spotted spider mites leaf": {
        "summary": "二斑叶螨会导致叶片失绿、斑驳，严重时叶片干枯。",
        "advice_key": "tomato_two_spotted_spider_mites_leaf",
    },
    "grape leaf": {
        "summary": "当前类别更接近葡萄健康叶片，建议继续保持果园通风透光，并重点预防黑腐病和霜霉类问题。",
        "advice_key": "grape_leaf",
    },
    "grape leaf black rot": {
        "summary": "葡萄黑腐病会引起叶片和果实病斑，影响产量与品质。",
        "advice_key": "grape_leaf_black_rot",
    },
}

_CLASS_KNOWLEDGE_PROFILES: List[Dict[str, object]] = [
    {
        "profile_key": "profile_rust",
        "keywords": ["rust", "锈病"],
        "summary": "{label}通常会在叶片上形成锈色或橙褐色病斑，早期识别和通风管理很关键。",
    },
    {
        "profile_key": "profile_spot",
        "keywords": ["spot", "leaf spot", "斑", "斑点病", "叶斑病"],
        "summary": "{label}常表现为叶片斑点或坏死区域扩展，重点在于控湿、清除病叶和阻断扩散。",
    },
    {
        "profile_key": "profile_blight",
        "keywords": ["blight", "枯病", "疫病"],
        "summary": "{label}这类病害往往扩展较快，容易造成叶片大面积坏死，需要尽快处理病株和湿度问题。",
    },
    {
        "profile_key": "profile_mildew",
        "keywords": ["powdery", "mildew", "白粉", "霉"],
        "summary": "{label}多与高湿、通风差有关，管理重点是控湿、通风和尽早处理受害叶片。",
    },
    {
        "profile_key": "profile_virus",
        "keywords": ["virus", "mosaic", "yellow", "病毒", "花叶", "黄化"],
        "summary": "{label}通常与病毒侵染或传播媒介有关，管理重点是隔离病株和控制传毒昆虫。",
    },
    {
        "profile_key": "profile_mite",
        "keywords": ["mite", "mites", "螨", "spider"],
        "summary": "{label}属于典型刺吸式害虫危害，重点应放在叶背巡查、虫口压低和持续复查。",
    },
    {
        "profile_key": "profile_insect",
        "keywords": ["aphid", "whitefly", "thrips", "虫", "蚜", "粉虱", "蓟马"],
        "summary": "{label}更偏向虫害问题，关键在于尽早发现虫口、处理受害叶片并控制传播来源。",
    },
    {
        "profile_key": "profile_rot",
        "keywords": ["rot", "腐病", "腐烂"],
        "summary": "{label}通常提示组织腐烂风险增加，管理重点是清除病残体、控湿和减少伤口感染。",
    },
]

_GENERIC_CLASS_KNOWLEDGE_ADVICE = [
    "先确认病斑或虫害是否在同类叶片上持续出现，再决定是否立即隔离处理。",
    "优先从通风、湿度、清除病残体和田间卫生管理入手，降低继续扩散的条件。",
    "结合本地农技建议或植保方案，选择更贴合该类别的后续防治措施并持续复查。",
]

_LEGACY_GENERIC_CLASS_ADVICE = [
    "先检查同一植株及周边叶片，确认是否出现类似病斑并及时隔离重病叶片。",
    "保持种植环境通风、降湿，避免叶面长期积水，减少病害继续扩散。",
    "结合当地农技建议或植保方案，尽快选择对应病害的防治措施并持续观察 3 到 5 天。",
]


def _strip_code_fences(text: str) -> str:
    cleaned = str(text or "").strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_first_json_object(text: str) -> str:
    candidate = str(text or "").strip()
    if not candidate:
        return ""

    start = candidate.find("{")
    if start < 0:
        return candidate

    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(candidate[start:], start=start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue
        if char == "{":
            depth += 1
            continue
        if char == "}":
            depth -= 1
            if depth == 0:
                return candidate[start:index + 1]

    return candidate


def _extract_message_text(payload: Dict[str, Any]) -> str:
    try:
        content = payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return ""

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = str(item.get("text") or "").strip()
                if text:
                    parts.append(text)
        return "\n".join(parts)

    return ""


def _extract_reasoning_text(payload: Dict[str, Any]) -> str:
    try:
        reasoning = payload["choices"][0]["message"]["reasoning_content"]
    except (KeyError, IndexError, TypeError):
        return ""

    if isinstance(reasoning, str):
        return reasoning

    if isinstance(reasoning, list):
        parts: List[str] = []
        for item in reasoning:
            if isinstance(item, dict) and item.get("type") == "text":
                text = str(item.get("text") or "").strip()
                if text:
                    parts.append(text)
        return "\n".join(parts)

    return ""


def _build_endpoint_url(api_url: str, base_url: str, chat_path: str) -> str:
    explicit_url = str(api_url or "").strip()
    if explicit_url:
        return explicit_url

    normalized_base = str(base_url or "").strip()
    normalized_path = str(chat_path or "").strip()
    if not normalized_base or not normalized_path:
        return ""

    return urljoin(f"{normalized_base.rstrip('/')}/", normalized_path.lstrip("/"))


def _normalize_image_content_type(image_content_type: Optional[str]) -> str:
    normalized = str(image_content_type or "").strip().lower()
    if normalized.startswith("image/"):
        return normalized
    return "image/jpeg"


def _prepare_image_for_api(
    image_bytes: bytes,
    image_content_type: Optional[str],
    max_bytes: int,
) -> Tuple[Optional[bytes], Optional[str]]:
    if not image_bytes:
        return None, None

    safe_type = _normalize_image_content_type(image_content_type)
    if len(image_bytes) <= max_bytes:
        return image_bytes, safe_type

    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != "RGB":
            image = image.convert("RGB")

        if max(image.size) > 1568:
            image.thumbnail((1568, 1568))

        for quality in (88, 80, 72, 64, 56):
            buffer = io.BytesIO()
            image.save(buffer, format="JPEG", quality=quality, optimize=True)
            candidate = buffer.getvalue()
            if len(candidate) <= max_bytes:
                return candidate, "image/jpeg"
    except Exception:
        return None, None

    return None, None


def _summarize_remote_error(exc: BaseException) -> str:
    if isinstance(exc, TimeoutError):
        return "远端大模型接口超时。"
    if isinstance(exc, error.URLError):
        return f"无法连接远端大模型接口：{exc.reason}"
    if isinstance(exc, error.HTTPError):
        try:
            body = exc.read().decode("utf-8", errors="ignore")
        except Exception:
            body = ""
        detail = ""
        if body:
            try:
                payload = json.loads(body)
                detail = str(payload.get("error", {}).get("message") or payload.get("detail") or "").strip()
            except Exception:
                detail = body.strip()
        return f"远端大模型接口返回 HTTP {exc.code}{f'：{detail}' if detail else ''}"
    if isinstance(exc, ValueError):
        return str(exc) or "远端大模型响应无效。"
    return str(exc) or "远端大模型请求失败。"


def _truncate_reasoning_text(text: str, max_chars: int = 2400) -> str:
    cleaned = str(text or "").strip()
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars].rstrip() + "\n...(truncated)"


def _looks_like_placeholder_text(text: str) -> bool:
    normalized = str(text or "").strip()
    if not normalized:
        return True
    compact = normalized.replace(" ", "")
    placeholder_values = {
        ".",
        "..",
        "...",
        "……",
        "-",
        "--",
        "一句话总结",
        "建议",
        "建议1",
        "建议2",
        "建议3",
    }
    return compact in placeholder_values


def _normalize_label_for_matching(label: str) -> str:
    lowered = str(label or "").strip().lower()
    lowered = lowered.replace("_", " ").replace("-", " ")
    lowered = re.sub(r"\s+", " ", lowered)
    return lowered


def _get_advice_pack(advice_key: str) -> List[str]:
    return [str(item).strip() for item in _CLASS_KNOWLEDGE_ADVICE_PACKS.get(advice_key, []) if str(item).strip()]


def _resolve_exact_class_knowledge(label: str) -> Optional[Dict[str, object]]:
    normalized_label = _normalize_label_for_matching(label)
    if not normalized_label:
        return None

    record = _EXACT_CLASS_KNOWLEDGE.get(normalized_label)
    if not record:
        return None

    alias_of = str(record.get("alias_of") or "").strip()
    if alias_of:
        record = _EXACT_CLASS_KNOWLEDGE.get(_normalize_label_for_matching(alias_of))
        if not record:
            return None

    advice_key = str(record.get("advice_key") or "").strip()
    advice = _get_advice_pack(advice_key)
    return {
        "summary": str(record.get("summary") or "").strip(),
        "advice": advice,
    }


def _select_class_knowledge_profile(label: str) -> Optional[Dict[str, object]]:
    normalized_label = _normalize_label_for_matching(label)
    if not normalized_label:
        return None
    for profile in _CLASS_KNOWLEDGE_PROFILES:
        keywords = [str(item).strip().lower() for item in profile.get("keywords", []) if str(item).strip()]
        if any(keyword in normalized_label for keyword in keywords):
            return profile
    return None


def build_fallback_class_knowledge(class_name: str, detail: str = "") -> Dict[str, object]:
    safe_label = str(class_name or "未知类别").strip() or "未知类别"
    exact = _resolve_exact_class_knowledge(safe_label)
    if exact:
        summary = str(exact.get("summary") or "").strip() or f"{safe_label}需要结合实际症状进一步判断。"
        advice = [str(item).strip() for item in exact.get("advice", []) if str(item).strip()]
    else:
        profile = _select_class_knowledge_profile(safe_label)
        if profile:
            summary = str(profile.get("summary") or "{label} 需要结合实际症状进一步判断。").format(label=safe_label)
            advice = [
                str(item).strip().format(label=safe_label)
                for item in _get_advice_pack(str(profile.get("profile_key") or ""))
                if str(item).strip()
            ]
        else:
            summary = f"{safe_label}建议结合叶片斑点颜色、扩展速度以及是否伴随虫口或霉层综合判断，再决定后续防治方向。"
            advice = list(_GENERIC_CLASS_KNOWLEDGE_ADVICE)

    payload = {
        "disease_label": safe_label,
        "summary": summary,
        "advice": advice or list(_GENERIC_CLASS_KNOWLEDGE_ADVICE),
        "source": "builtin",
    }
    if detail:
        payload["detail"] = detail
    return payload


def _looks_like_generic_class_knowledge(payload: Optional[Dict[str, object]]) -> bool:
    if not payload:
        return False
    summary = str(payload.get("summary") or "").strip()
    advice = [str(item).strip() for item in payload.get("advice", []) if str(item).strip()]
    if summary.startswith("系统根据当前识别结果判断为 "):
        return True
    return advice == _LEGACY_GENERIC_CLASS_ADVICE


def _choose_preferred_local_model(model_names: List[str]) -> str:
    candidates = [str(name or "").strip() for name in model_names if str(name or "").strip()]
    if not candidates:
        return ""

    preferred_prefixes = (
        "qwen2.5",
        "qwen",
        "llama3.2",
        "llama3",
        "gemma3",
        "gemma2",
        "phi4",
        "phi3",
        "mistral",
    )
    lowered = [(name, name.lower()) for name in candidates]
    for prefix in preferred_prefixes:
        for original, normalized in lowered:
            if normalized.startswith(prefix):
                return original
    return candidates[0]


def _detect_local_ollama_model(timeout: int = 2) -> str:
    try:
        req = request.Request(
            LOCAL_OLLAMA_TAGS_URL,
            method="GET",
            headers={"Accept": "application/json"},
        )
        with request.urlopen(req, timeout=max(1, int(timeout))) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception:
        return ""

    models = payload.get("models")
    if not isinstance(models, list):
        return ""

    names: List[str] = []
    for item in models:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if name:
            names.append(name)
    return _choose_preferred_local_model(names)


def build_fallback_advice(
    disease_label: str,
    confidence: float = 0.0,
    detail: str = "",
) -> Dict[str, object]:
    safe_label = str(disease_label or "未知病害").strip() or "未知病害"
    translated_confidence = f"{confidence * 100:.1f}%"
    payload = {
        "disease_label": safe_label,
        "summary": f"系统根据当前识别结果判断为 {safe_label}，当前置信度约为 {translated_confidence}。建议先复查叶片症状，再尽快采取隔离、通风和病叶清理措施。",
        "advice": [
            "先检查同一植株及周边叶片，确认是否出现类似病斑并及时隔离重病叶片。",
            "保持种植环境通风、降湿，避免叶面长期积水，减少病害继续扩散。",
            "结合当地农技建议或植保方案，尽快选择对应病害的防治措施并持续观察 3 到 5 天。",
        ],
        "source": "builtin",
    }
    if detail:
        payload["detail"] = detail
    return payload


def _build_reasoning_only_result(
    disease_label: str,
    confidence: float,
    source: str,
    detail: str,
) -> Dict[str, object]:
    payload = build_fallback_advice(disease_label, confidence, detail)
    payload["source"] = f"{source}-reasoning"
    return payload


class AiAdviceService:
    def __init__(self) -> None:
        self.api_url = str(settings.ai_api_url or "").strip()
        self.api_base_url = str(settings.ai_api_base_url or "").strip()
        self.api_chat_path = str(settings.ai_api_chat_path or "").strip()
        self.endpoint_url = _build_endpoint_url(self.api_url, self.api_base_url, self.api_chat_path)
        self.api_key = str(settings.ai_api_key or "").strip()
        self.model_name = str(settings.ai_api_model or "").strip()
        self.timeout = max(5, int(settings.ai_api_timeout))
        self.max_image_bytes = max(256 * 1024, int(settings.ai_api_max_image_bytes))
        self.image_detail = str(settings.ai_api_image_detail or "auto").strip() or "auto"
        if not self.endpoint_url and not self.model_name:
            local_model_name = _detect_local_ollama_model()
            if local_model_name:
                self.endpoint_url = LOCAL_OLLAMA_CHAT_URL
                self.model_name = local_model_name

    def _is_configured(self) -> bool:
        return bool(self.endpoint_url and self.model_name)

    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _perform_request(self, payload: Dict[str, Any]) -> str:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = request.Request(
            self.endpoint_url,
            data=body,
            method="POST",
            headers=self._build_headers(),
        )
        with request.urlopen(req, timeout=self.timeout) as response:
            return response.read().decode("utf-8")

    def _post_chat_payload(self, payload: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
        try:
            raw_text = self._perform_request(payload)
        except error.HTTPError as exc:
            if "response_format" not in payload:
                return None, _summarize_remote_error(exc)
            retry_payload = dict(payload)
            retry_payload.pop("response_format", None)
            try:
                raw_text = self._perform_request(retry_payload)
            except (error.URLError, error.HTTPError, TimeoutError, ValueError) as retry_exc:
                return None, _summarize_remote_error(retry_exc)
        except (error.URLError, TimeoutError, ValueError) as exc:
            return None, _summarize_remote_error(exc)

        try:
            return json.loads(raw_text), ""
        except (TypeError, ValueError, json.JSONDecodeError):
            return None, "远端大模型返回了无法解析的 JSON 响应。"

    def _parse_result_text(self, text: str, disease_label: str, confidence: float, source: str) -> Optional[Dict[str, object]]:
        cleaned_text = _extract_first_json_object(_strip_code_fences(text))
        if not cleaned_text:
            return None

        try:
            parsed = json.loads(cleaned_text)
        except (TypeError, ValueError, json.JSONDecodeError):
            return None

        summary = str(parsed.get("summary") or "").strip()
        advice_raw = parsed.get("advice")
        if isinstance(advice_raw, list):
            advice_items = advice_raw
        elif advice_raw:
            advice_items = [advice_raw]
        else:
            advice_items = []

        cleaned_advice = [str(item).strip() for item in advice_items if str(item).strip()]
        cleaned_advice = [item for item in cleaned_advice if not _looks_like_placeholder_text(item)]
        if not summary or _looks_like_placeholder_text(summary):
            return None
        if not cleaned_advice:
            cleaned_advice = list(build_fallback_advice(disease_label, confidence)["advice"])

        return {
            "disease_label": disease_label,
            "summary": summary,
            "advice": cleaned_advice[:5],
            "source": source,
        }

    def _build_reasoning_recovery_payload(
        self,
        target_kind: str,
        reasoning_text: str,
        *,
        disease_label: str = "",
        confidence: float = 0.0,
        top_predictions: Optional[List[Dict[str, object]]] = None,
        class_name: str = "",
    ) -> Dict[str, Any]:
        context_payload: Dict[str, Any] = {}
        if target_kind == "class-knowledge":
            context_payload = {
                "class_name": class_name,
                "task": "请根据类别名称输出可长期缓存的病害知识建议。",
            }
            system_prompt = (
                "你会收到上一轮模型返回的 reasoning_content。"
                "不要复述推理，不要继续长篇分析，只提取最终可展示结论。"
                "必须只返回 JSON，不要加 Markdown。"
                '格式固定为：{"summary":"一句话总结","advice":["建议1","建议2","建议3"]}'
            )
        else:
            context_payload = {
                "disease_label": disease_label,
                "confidence": confidence,
                "top_predictions": list(top_predictions or [])[:3],
                "task": "请根据识别结果输出适合前端展示的病害总结与建议。",
            }
            system_prompt = (
                "你会收到上一轮模型返回的 reasoning_content。"
                "不要复述推理，不要继续长篇分析，只提取最终可展示结论。"
                "如果 reasoning 没有给出明确结论，就基于已知病害名和置信度给出保守建议。"
                "必须只返回 JSON，不要加 Markdown。"
                '格式固定为：{"summary":"一句话总结","advice":["建议1","建议2","建议3"]}'
            )

        return {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "context": context_payload,
                            "reasoning_content": _truncate_reasoning_text(reasoning_text),
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "temperature": 0.1,
            "max_tokens": 160,
            "response_format": {"type": "json_object"},
        }

    def _recover_result_from_reasoning(
        self,
        payload: Dict[str, Any],
        *,
        target_kind: str,
        disease_label: str,
        confidence: float,
        source: str,
        top_predictions: Optional[List[Dict[str, object]]] = None,
        class_name: str = "",
    ) -> Tuple[Optional[Dict[str, object]], str]:
        reasoning_text = _extract_reasoning_text(payload)
        if not reasoning_text:
            return None, ""

        parsed_from_reasoning = self._parse_result_text(reasoning_text, disease_label, confidence, source)
        if parsed_from_reasoning:
            return parsed_from_reasoning, ""

        recovery_payload = self._build_reasoning_recovery_payload(
            target_kind,
            reasoning_text,
            disease_label=disease_label,
            confidence=confidence,
            top_predictions=top_predictions,
            class_name=class_name,
        )
        recovered_raw_payload, recovery_error = self._post_chat_payload(recovery_payload)
        if not recovered_raw_payload:
            return None, recovery_error

        recovered_result = self._parse_result_text(
            _extract_message_text(recovered_raw_payload),
            disease_label,
            confidence,
            source,
        )
        if recovered_result:
            return recovered_result, ""

        recovered_result = self._parse_result_text(
            _extract_reasoning_text(recovered_raw_payload),
            disease_label,
            confidence,
            source,
        )
        if recovered_result:
            return recovered_result, ""

        return _build_reasoning_only_result(
            disease_label,
            confidence,
            source,
            "远端大模型只返回了 reasoning_content，已自动转换为保守建议。",
        ), ""

    def _parse_result(self, payload: Dict[str, Any], disease_label: str, confidence: float, source: str) -> Optional[Dict[str, object]]:
        parsed = self._parse_result_text(_extract_message_text(payload), disease_label, confidence, source)
        if parsed:
            return parsed
        return self._parse_result_text(_extract_reasoning_text(payload), disease_label, confidence, source)

    def _build_text_payload(self, disease_label: str, confidence: float, top_predictions: List[Dict[str, object]]) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是农业植保助手。请根据植物病害识别结果，给出谨慎、简洁、可执行的中文建议。"
                        "不要编造没有提供的图像细节。必须只返回 JSON，不要加 Markdown。"
                        '格式固定为：{"summary":"一句话总结","advice":["建议1","建议2","建议3"]}'
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "disease_label": disease_label,
                            "confidence": confidence,
                            "top_predictions": top_predictions[:3],
                            "task": "请基于识别结果给出适合前端直接展示的诊断总结与处理建议。",
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "temperature": 0.2,
            "max_tokens": 160,
            "response_format": {"type": "json_object"},
        }

    def _build_class_knowledge_payload(self, class_name: str) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是农业植保知识库助手。请根据给定的植物病害或作物类别名称，"
                        "返回适合长期存入系统知识库的中文建议。"
                        "如果类别是健康叶片、正常状态或信息不足，请给出保守的养护与观察建议。"
                        "不要输出 Markdown，不要虚构没有依据的具体药剂和剂量。"
                        '必须只返回 JSON，格式固定为：{"summary":"一句话总结","advice":["建议1","建议2","建议3"]}'
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "class_name": class_name,
                            "task": "请基于类别名称生成适合前端直接展示和长期缓存的总结与处理建议。",
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "temperature": 0.2,
            "max_tokens": 160,
            "response_format": {"type": "json_object"},
        }

    def _build_vision_payload(
        self,
        image_bytes: bytes,
        image_content_type: Optional[str],
        disease_label: str,
        confidence: float,
        top_predictions: List[Dict[str, object]],
    ) -> Optional[Dict[str, Any]]:
        prepared_image_bytes, prepared_content_type = _prepare_image_for_api(
            image_bytes=image_bytes,
            image_content_type=image_content_type,
            max_bytes=self.max_image_bytes,
        )
        if not prepared_image_bytes or not prepared_content_type:
            return None

        data_url = "data:{};base64,{}".format(
            prepared_content_type,
            base64.b64encode(prepared_image_bytes).decode("ascii"),
        )
        return {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是农业植保助手。请先观察图片本身，再参考机器识别结果，输出谨慎、简洁、可执行的中文分析。"
                        "如果图片信息不足或无法确认病害，请明确说明，不要过度确定。"
                        "必须只返回 JSON，不要加 Markdown。"
                        '格式固定为：{"summary":"一句话总结，需体现可见症状与总体判断","advice":["建议1","建议2","建议3"]}'
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": json.dumps(
                                {
                                    "recognition_result": {
                                        "disease_label": disease_label,
                                        "confidence": confidence,
                                        "top_predictions": top_predictions[:3],
                                    },
                                    "task": "请结合图片可见症状和识别结果，先概括叶片当前情况，再给出 3 条处理建议。",
                                },
                                ensure_ascii=False,
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url,
                                "detail": self.image_detail,
                            },
                        },
                    ],
                },
            ],
            "temperature": 0.2,
            "max_tokens": 160,
            "response_format": {"type": "json_object"},
        }

    def _call_remote_text_ai(
        self,
        disease_label: str,
        confidence: float,
        top_predictions: List[Dict[str, object]],
    ) -> Tuple[Optional[Dict[str, object]], str]:
        if not self._is_configured():
            return None, ""

        payload = self._build_text_payload(disease_label, confidence, top_predictions)
        raw_payload, error_detail = self._post_chat_payload(payload)
        if not raw_payload:
            return None, error_detail
        parsed = self._parse_result(raw_payload, disease_label, confidence, "ai-text")
        if parsed:
            return parsed, ""
        recovered, recovery_error = self._recover_result_from_reasoning(
            raw_payload,
            target_kind="text-advice",
            disease_label=disease_label,
            confidence=confidence,
            source="ai-text",
            top_predictions=top_predictions,
        )
        return recovered, recovery_error

    def _call_remote_vision_ai(
        self,
        image_bytes: bytes,
        image_content_type: Optional[str],
        disease_label: str,
        confidence: float,
        top_predictions: List[Dict[str, object]],
    ) -> Tuple[Optional[Dict[str, object]], str]:
        if not self._is_configured() or not image_bytes:
            return None, ""

        payload = self._build_vision_payload(
            image_bytes=image_bytes,
            image_content_type=image_content_type,
            disease_label=disease_label,
            confidence=confidence,
            top_predictions=top_predictions,
        )
        if not payload:
            return None, "图片无法压缩到远端多模态接口允许的大小范围内。"

        raw_payload, error_detail = self._post_chat_payload(payload)
        if not raw_payload:
            return None, error_detail
        parsed = self._parse_result_text(_extract_message_text(raw_payload), disease_label, confidence, "ai-vision")
        if parsed:
            return parsed, ""
        recovered, recovery_error = self._recover_result_from_reasoning(
            raw_payload,
            target_kind="vision-advice",
            disease_label=disease_label,
            confidence=confidence,
            source="ai-vision",
            top_predictions=top_predictions,
        )
        return recovered, recovery_error

    def generate(
        self,
        disease_label: str,
        confidence: float = 0.0,
        top_predictions: Optional[List[Dict[str, object]]] = None,
        image_bytes: Optional[bytes] = None,
        image_content_type: Optional[str] = None,
    ) -> Dict[str, object]:
        safe_label = str(disease_label or "No detection").strip() or "No detection"
        safe_predictions = list(top_predictions or [])
        remote_failure_detail = ""

        if image_bytes:
            vision_result, vision_error_detail = self._call_remote_vision_ai(
                image_bytes=image_bytes,
                image_content_type=image_content_type,
                disease_label=safe_label,
                confidence=confidence,
                top_predictions=safe_predictions,
            )
            if vision_result:
                return vision_result
            if vision_error_detail:
                remote_failure_detail = vision_error_detail

        if safe_label != "No detection":
            remote_text_result, text_error_detail = self._call_remote_text_ai(
                disease_label=safe_label,
                confidence=confidence,
                top_predictions=safe_predictions,
            )
            if remote_text_result:
                return remote_text_result
            if text_error_detail:
                remote_failure_detail = text_error_detail

            return build_fallback_advice(safe_label, confidence, remote_failure_detail)

        return {
            "disease_label": "No detection",
            "summary": "当前没有识别到明确病害目标，建议重新拍摄更清晰的叶片图像后再识别。",
            "advice": [
                "尽量在光线充足的环境下重新拍摄。",
                "让叶片主体尽量完整并靠近画面中心。",
                "如果仍无法识别，可结合人工观察进一步判断。",
            ],
            "source": "builtin",
        }

    def generate_class_knowledge(self, class_name: str) -> Dict[str, object]:
        safe_label = str(class_name or "未知类别").strip() or "未知类别"
        if _resolve_exact_class_knowledge(safe_label):
            return build_fallback_class_knowledge(safe_label)
        if not self._is_configured():
            return build_fallback_class_knowledge(safe_label)

        payload = self._build_class_knowledge_payload(safe_label)
        raw_payload, error_detail = self._post_chat_payload(payload)
        if raw_payload:
            parsed = self._parse_result_text(_extract_message_text(raw_payload), safe_label, 1.0, "ai-text")
            if parsed:
                if _looks_like_generic_class_knowledge(parsed):
                    return build_fallback_class_knowledge(
                        safe_label,
                        "远端大模型返回了通用识别文案，已切换为按类别生成的知识建议。",
                    )
                return parsed
            recovered, recovery_error = self._recover_result_from_reasoning(
                raw_payload,
                target_kind="class-knowledge",
                disease_label=safe_label,
                confidence=1.0,
                source="ai-text",
                class_name=safe_label,
            )
            if recovered:
                if _looks_like_generic_class_knowledge(recovered):
                    return build_fallback_class_knowledge(
                        safe_label,
                        "远端大模型返回了通用识别文案，已切换为按类别生成的知识建议。",
                    )
                return recovered
            error_detail = recovery_error or error_detail
            error_detail = error_detail or "远端大模型返回了无法解析的建议内容。"

        return build_fallback_class_knowledge(safe_label, error_detail)
