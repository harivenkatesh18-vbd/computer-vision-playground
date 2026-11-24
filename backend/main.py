
import os
import base64
import tempfile
import threading
from io import BytesIO
from time import perf_counter

import cv2
import numpy as np
import onnxruntime as ort

from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Optional AVIF support
try:
    import pillow_avif
except ImportError:
    pillow_avif = None


# =========================================================
# APPLICATION
# =========================================================

app = FastAPI(
    title="VisionLab API",
    description="Computer Vision and Visual Intelligence Platform",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_SIZE = 20 * 1024 * 1024
MAX_VIDEO_SIZE = 100 * 1024 * 1024
MAX_PIXELS = 40_000_000

SUPPORTED_VIDEO_EXTENSIONS = {
    ".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"
}


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
def root():
    return {
        "application": "VisionLab",
        "message": "Computer Vision API is running",
        "documentation": "/docs",
    }


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "application": "VisionLab",
        "opencv_version": cv2.__version__,
        "image_processing_operations": [
            "grayscale",
            "blur",
            "median",
            "bilateral",
            "edges",
            "sharpen",
            "threshold",
            "adaptive-threshold",
            "equalize",
            "clahe",
            "rotate",
            "flip",
        ],
        "color_operations": [
            "analyze",
            "segment",
        ],
        "analysis_modules": [
            "shape_analysis",
            "object_detection",
            "video_intelligence",
        ],
    }


# =========================================================
# COMMON IMAGE UTILITIES
# =========================================================

async def decode_image(file: UploadFile):
    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum image size is 20 MB.",
        )

    try:
        with Image.open(BytesIO(contents)) as pil_image:
            width, height = pil_image.size

            if width <= 0 or height <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid image dimensions.",
                )

            if width * height > MAX_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail="Image dimensions exceed the 40-megapixel limit.",
                )

            pil_image.load()

            if "A" in pil_image.getbands():
                rgba = pil_image.convert("RGBA")

                background = Image.new(
                    "RGBA",
                    rgba.size,
                    (255, 255, 255, 255),
                )

                background.alpha_composite(rgba)
                pil_image = background.convert("RGB")
            else:
                pil_image = pil_image.convert("RGB")

            rgb = np.array(pil_image)

            return cv2.cvtColor(
                rgb,
                cv2.COLOR_RGB2BGR,
            )

    except HTTPException:
        raise

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported or corrupted image. "
                "Try JPEG, PNG, WEBP, BMP, TIFF or AVIF."
            ),
        )


def encode_image(image):
    success, encoded = cv2.imencode(".png", image)

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Unable to encode the processed image.",
        )

    return StreamingResponse(
        BytesIO(encoded.tobytes()),
        media_type="image/png",
        headers={
            "Content-Disposition": (
                'inline; filename="visionlab_result.png"'
            )
        },
    )


def image_to_data_url(image, extension=".png"):
    success, encoded = cv2.imencode(extension, image)

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Unable to encode the analysis image.",
        )

    encoded_data = base64.b64encode(
        encoded.tobytes()
    ).decode("utf-8")

    mime = "image/jpeg" if extension == ".jpg" else "image/png"

    return f"data:{mime};base64,{encoded_data}"


def validate_kernel_size(value: int, minimum: int = 1):
    if value < minimum or value > 51 or value % 2 == 0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Kernel size must be an odd number "
                f"between {minimum} and 51."
            ),
        )


def to_grayscale(image):
    return cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )


# =========================================================
# 1. IMAGE PROCESSING
# =========================================================

@app.post("/api/process/grayscale")
async def grayscale(file: UploadFile = File(...)):
    image = await decode_image(file)
    return encode_image(to_grayscale(image))


@app.post("/api/process/blur")
async def gaussian_blur(
    file: UploadFile = File(...),
    kernel_size: int = Query(5, ge=1, le=51),
):
    validate_kernel_size(kernel_size)
    image = await decode_image(file)

    result = cv2.GaussianBlur(
        image,
        (kernel_size, kernel_size),
        0,
    )

    return encode_image(result)


@app.post("/api/process/median")
async def median_blur(
    file: UploadFile = File(...),
    kernel_size: int = Query(5, ge=1, le=51),
):
    validate_kernel_size(kernel_size)
    image = await decode_image(file)

    result = (
        image
        if kernel_size == 1
        else cv2.medianBlur(image, kernel_size)
    )

    return encode_image(result)


@app.post("/api/process/bilateral")
async def bilateral_filter(
    file: UploadFile = File(...),
    kernel_size: int = Query(9, ge=1, le=51),
):
    validate_kernel_size(kernel_size)
    image = await decode_image(file)

    result = cv2.bilateralFilter(
        image,
        d=kernel_size,
        sigmaColor=75,
        sigmaSpace=75,
    )

    return encode_image(result)


@app.post("/api/process/edges")
async def canny_edges(file: UploadFile = File(...)):
    image = await decode_image(file)
    result = cv2.Canny(to_grayscale(image), 100, 200)
    return encode_image(result)


@app.post("/api/process/sharpen")
async def sharpen(file: UploadFile = File(...)):
    image = await decode_image(file)

    kernel = np.array(
        [
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0],
        ],
        dtype=np.float32,
    )

    return encode_image(
        cv2.filter2D(image, -1, kernel)
    )


@app.post("/api/process/threshold")
async def binary_threshold(
    file: UploadFile = File(...),
    threshold_value: int = Query(127, ge=0, le=255),
):
    image = await decode_image(file)
    gray = to_grayscale(image)

    _, result = cv2.threshold(
        gray,
        threshold_value,
        255,
        cv2.THRESH_BINARY,
    )

    return encode_image(result)


@app.post("/api/process/adaptive-threshold")
async def adaptive_threshold(
    file: UploadFile = File(...),
    kernel_size: int = Query(11, ge=3, le=51),
):
    validate_kernel_size(kernel_size, minimum=3)

    image = await decode_image(file)
    gray = to_grayscale(image)

    result = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        kernel_size,
        2,
    )

    return encode_image(result)


@app.post("/api/process/equalize")
async def histogram_equalization(file: UploadFile = File(...)):
    image = await decode_image(file)
    return encode_image(
        cv2.equalizeHist(to_grayscale(image))
    )


@app.post("/api/process/clahe")
async def clahe(
    file: UploadFile = File(...),
    clip_limit: float = Query(2.0, ge=0.1, le=10.0),
):
    image = await decode_image(file)

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    lightness, channel_a, channel_b = cv2.split(lab)

    clahe_filter = cv2.createCLAHE(
        clipLimit=clip_limit,
        tileGridSize=(8, 8),
    )

    enhanced_lightness = clahe_filter.apply(lightness)

    enhanced_lab = cv2.merge(
        [enhanced_lightness, channel_a, channel_b]
    )

    return encode_image(
        cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    )


@app.post("/api/process/rotate")
async def rotate(
    file: UploadFile = File(...),
    angle: float = Query(90, ge=-180, le=180),
):
    image = await decode_image(file)

    height, width = image.shape[:2]
    center = (width / 2, height / 2)

    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

    abs_cos = abs(matrix[0, 0])
    abs_sin = abs(matrix[0, 1])

    new_width = int(height * abs_sin + width * abs_cos)
    new_height = int(height * abs_cos + width * abs_sin)

    matrix[0, 2] += new_width / 2 - center[0]
    matrix[1, 2] += new_height / 2 - center[1]

    result = cv2.warpAffine(
        image,
        matrix,
        (new_width, new_height),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(255, 255, 255),
    )

    return encode_image(result)


@app.post("/api/process/flip")
async def flip(
    file: UploadFile = File(...),
    flip_code: int = Query(1, ge=-1, le=1),
):
    image = await decode_image(file)
    return encode_image(cv2.flip(image, flip_code))


# =========================================================
# 2. COLOR INTELLIGENCE
# =========================================================

@app.post("/api/color/analyze")
async def color_analyze(
    file: UploadFile = File(...),
    color_space: str = Query(
        "RGB",
        pattern="^(RGB|HSV|LAB)$",
    ),
    colors: int = Query(5, ge=1, le=10),
):
    image = await decode_image(file)

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    if color_space == "RGB":
        converted = rgb
    elif color_space == "HSV":
        converted = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    else:
        converted = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)

    pixels = rgb.reshape(-1, 3)

    if len(pixels) > 20000:
        indices = np.linspace(
            0,
            len(pixels) - 1,
            20000,
            dtype=np.int32,
        )
        pixels = pixels[indices]

    pixels = np.float32(pixels)
    unique_pixels = np.unique(pixels, axis=0)
    k = min(colors, len(unique_pixels))

    if k == 1:
        centers = np.mean(
            pixels,
            axis=0,
            keepdims=True,
        )
        labels = np.zeros(len(pixels), dtype=np.int32)
    else:
        criteria = (
            cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
            30,
            0.5,
        )

        _, labels, centers = cv2.kmeans(
            pixels,
            k,
            None,
            criteria,
            3,
            cv2.KMEANS_PP_CENTERS,
        )

    counts = np.bincount(labels.flatten(), minlength=k)
    percentages = (counts / counts.sum()) * 100

    dominant_colors = []

    for index, center in enumerate(centers):
        r, g, b = np.clip(center, 0, 255).astype(int)

        dominant_colors.append({
            "hex": f"#{r:02X}{g:02X}{b:02X}",
            "rgb": [int(r), int(g), int(b)],
            "percentage": round(float(percentages[index]), 2),
        })

    dominant_colors.sort(
        key=lambda item: item["percentage"],
        reverse=True,
    )

    channel_means = np.mean(
        converted.reshape(-1, 3),
        axis=0,
    )

    channel_names = {
        "RGB": ["Red", "Green", "Blue"],
        "HSV": ["Hue", "Saturation", "Value"],
        "LAB": ["L", "A", "B"],
    }

    return {
        "color_space": color_space,
        "image_dimensions": {
            "width": int(image.shape[1]),
            "height": int(image.shape[0]),
        },
        "channel_means": {
            name: round(float(value), 2)
            for name, value in zip(
                channel_names[color_space],
                channel_means,
            )
        },
        "dominant_colors": dominant_colors,
        "sampled_pixels": int(len(pixels)),
    }


@app.post("/api/color/segment")
async def color_segment(
    file: UploadFile = File(...),
    hue_min: int = Query(0, ge=0, le=179),
    hue_max: int = Query(179, ge=0, le=179),
    saturation_min: int = Query(50, ge=0, le=255),
    saturation_max: int = Query(255, ge=0, le=255),
    value_min: int = Query(50, ge=0, le=255),
    value_max: int = Query(255, ge=0, le=255),
):
    if saturation_min > saturation_max:
        raise HTTPException(
            400,
            "Minimum saturation cannot exceed maximum saturation.",
        )

    if value_min > value_max:
        raise HTTPException(
            400,
            "Minimum value cannot exceed maximum value.",
        )

    image = await decode_image(file)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    if hue_min <= hue_max:
        lower = np.array(
            [hue_min, saturation_min, value_min],
            dtype=np.uint8,
        )
        upper = np.array(
            [hue_max, saturation_max, value_max],
            dtype=np.uint8,
        )

        mask = cv2.inRange(hsv, lower, upper)
    else:
        lower_a = np.array(
            [hue_min, saturation_min, value_min],
            dtype=np.uint8,
        )
        upper_a = np.array(
            [179, saturation_max, value_max],
            dtype=np.uint8,
        )

        lower_b = np.array(
            [0, saturation_min, value_min],
            dtype=np.uint8,
        )
        upper_b = np.array(
            [hue_max, saturation_max, value_max],
            dtype=np.uint8,
        )

        mask = cv2.bitwise_or(
            cv2.inRange(hsv, lower_a, upper_a),
            cv2.inRange(hsv, lower_b, upper_b),
        )

    return encode_image(mask)


# =========================================================
# 3. SHAPE ANALYSIS
# =========================================================

@app.post("/api/shapes/analyze")
async def analyze_shapes(
    file: UploadFile = File(...),
    threshold_mode: str = Query(
        "otsu",
        pattern="^(binary|inverse|otsu|adaptive)$",
    ),
    threshold_value: int = Query(127, ge=0, le=255),
    min_area: float = Query(100, ge=0),
    epsilon_factor: float = Query(0.02, ge=0.001, le=0.1),
):
    image = await decode_image(file)
    gray = to_grayscale(image)

    if threshold_mode == "binary":
        _, binary = cv2.threshold(
            gray, threshold_value, 255, cv2.THRESH_BINARY
        )
    elif threshold_mode == "inverse":
        _, binary = cv2.threshold(
            gray, threshold_value, 255, cv2.THRESH_BINARY_INV
        )
    elif threshold_mode == "adaptive":
        binary = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,
            2,
        )
    else:
        _, binary = cv2.threshold(
            gray,
            0,
            255,
            cv2.THRESH_BINARY + cv2.THRESH_OTSU,
        )

    kernel = np.ones((3, 3), dtype=np.uint8)

    cleaned = cv2.morphologyEx(
        binary,
        cv2.MORPH_OPEN,
        kernel,
    )

    contours, _ = cv2.findContours(
        cleaned,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    annotated = image.copy()
    detected_shapes = []

    contours = sorted(
        contours,
        key=cv2.contourArea,
        reverse=True,
    )

    for contour in contours:
        area = float(cv2.contourArea(contour))

        if area < min_area:
            continue

        perimeter = float(cv2.arcLength(contour, True))

        if perimeter <= 0:
            continue

        approximation = cv2.approxPolyDP(
            contour,
            epsilon_factor * perimeter,
            True,
        )

        vertices = len(approximation)
        x, y, width, height = cv2.boundingRect(contour)

        moments = cv2.moments(contour)

        if moments["m00"] != 0:
            center_x = int(moments["m10"] / moments["m00"])
            center_y = int(moments["m01"] / moments["m00"])
        else:
            center_x = x + width // 2
            center_y = y + height // 2

        circularity = (4 * np.pi * area) / (perimeter * perimeter)
        aspect_ratio = width / height if height else 0.0

        hull = cv2.convexHull(contour)
        hull_area = float(cv2.contourArea(hull))
        solidity = area / hull_area if hull_area > 0 else 0.0

        if circularity >= 0.85 and vertices >= 5:
            shape_name = "Circle"
        elif vertices == 3:
            shape_name = "Triangle"
        elif vertices == 4:
            shape_name = (
                "Square"
                if 0.90 <= aspect_ratio <= 1.10
                else "Rectangle"
            )
        elif vertices == 5:
            shape_name = "Pentagon"
        elif vertices == 6:
            shape_name = "Hexagon"
        elif vertices > 6:
            shape_name = "Polygon"
        else:
            shape_name = "Irregular"

        object_number = len(detected_shapes) + 1

        cv2.drawContours(
            annotated,
            [contour],
            -1,
            (70, 105, 235),
            2,
        )

        cv2.rectangle(
            annotated,
            (x, y),
            (x + width, y + height),
            (30, 170, 125),
            2,
        )

        cv2.circle(
            annotated,
            (center_x, center_y),
            4,
            (0, 0, 255),
            -1,
        )

        cv2.putText(
            annotated,
            f"{object_number}. {shape_name}",
            (x, max(y - 8, 18)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (30, 70, 190),
            2,
            cv2.LINE_AA,
        )

        detected_shapes.append({
            "id": object_number,
            "shape": shape_name,
            "area": round(area, 2),
            "perimeter": round(perimeter, 2),
            "vertices": vertices,
            "bounding_box": {
                "x": int(x),
                "y": int(y),
                "width": int(width),
                "height": int(height),
            },
            "centroid": {
                "x": center_x,
                "y": center_y,
            },
            "aspect_ratio": round(aspect_ratio, 3),
            "circularity": round(float(circularity), 3),
            "solidity": round(float(solidity), 3),
        })

    height, width = image.shape[:2]

    return {
        "status": "success",
        "image_dimensions": {
            "width": int(width),
            "height": int(height),
        },
        "total_contours": len(contours),
        "detected_objects": len(detected_shapes),
        "threshold_mode": threshold_mode,
        "shapes": detected_shapes,
        "annotated_image": image_to_data_url(annotated),
    }


# =========================================================
# 4. OBJECT DETECTION — YOLO11n ONNX
# =========================================================

DETECTION_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "models",
    "yolo11n.onnx",
)

COCO_CLASSES = [
    "person", "bicycle", "car", "motorcycle", "airplane",
    "bus", "train", "truck", "boat", "traffic light",
    "fire hydrant", "stop sign", "parking meter", "bench",
    "bird", "cat", "dog", "horse", "sheep", "cow",
    "elephant", "bear", "zebra", "giraffe", "backpack",
    "umbrella", "handbag", "tie", "suitcase", "frisbee",
    "skis", "snowboard", "sports ball", "kite", "baseball bat",
    "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon",
    "bowl", "banana", "apple", "sandwich", "orange", "broccoli",
    "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "couch", "potted plant", "bed", "dining table", "toilet",
    "tv", "laptop", "mouse", "remote", "keyboard", "cell phone",
    "microwave", "oven", "toaster", "sink", "refrigerator",
    "book", "clock", "vase", "scissors", "teddy bear",
    "hair drier", "toothbrush",
]

detection_session = None
detection_lock = threading.Lock()


def get_detection_session():
    global detection_session

    if detection_session is None:
        with detection_lock:
            if detection_session is None:
                if not os.path.isfile(DETECTION_MODEL_PATH):
                    raise HTTPException(
                        status_code=500,
                        detail="YOLO model file not found.",
                    )

                options = ort.SessionOptions()
                options.intra_op_num_threads = max(
                    1,
                    min(4, os.cpu_count() or 1),
                )
                options.graph_optimization_level = (
                    ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                )

                detection_session = ort.InferenceSession(
                    DETECTION_MODEL_PATH,
                    sess_options=options,
                    providers=["CPUExecutionProvider"],
                )

    return detection_session


def letterbox_image(image, size=640):
    height, width = image.shape[:2]

    scale = min(size / width, size / height)

    new_width = int(round(width * scale))
    new_height = int(round(height * scale))

    resized = cv2.resize(
        image,
        (new_width, new_height),
        interpolation=cv2.INTER_LINEAR,
    )

    canvas = np.full(
        (size, size, 3),
        114,
        dtype=np.uint8,
    )

    pad_x = (size - new_width) // 2
    pad_y = (size - new_height) // 2

    canvas[
        pad_y:pad_y + new_height,
        pad_x:pad_x + new_width
    ] = resized

    return canvas, scale, pad_x, pad_y


def run_object_detection(
    image,
    confidence=0.25,
    iou_threshold=0.45,
):
    original_height, original_width = image.shape[:2]

    session = get_detection_session()
    input_info = session.get_inputs()[0]
    input_name = input_info.name
    input_shape = input_info.shape

    input_height = (
        input_shape[2]
        if isinstance(input_shape[2], int)
        else 640
    )

    input_width = (
        input_shape[3]
        if isinstance(input_shape[3], int)
        else 640
    )

    if input_width != input_height:
        raise ValueError(
            "This model integration requires a square YOLO input."
        )

    prepared, scale, pad_x, pad_y = letterbox_image(
        image,
        input_width,
    )

    rgb = cv2.cvtColor(prepared, cv2.COLOR_BGR2RGB)

    tensor = (
        rgb.astype(np.float32) / 255.0
    ).transpose(2, 0, 1)[None, ...]

    outputs = session.run(
        None,
        {input_name: tensor},
    )

    predictions = np.asarray(outputs[0])

    if predictions.ndim == 3:
        predictions = predictions[0]

    if predictions.ndim != 2:
        raise ValueError("Unexpected YOLO output dimensions.")

    if predictions.shape[0] < predictions.shape[1]:
        predictions = predictions.T

    if predictions.shape[1] != 84:
        raise ValueError(
            "Unexpected model output. Expected 84 values "
            "per detection (4 box + 80 class scores)."
        )

    boxes = []
    scores = []
    class_ids = []

    for prediction in predictions:
        class_scores = prediction[4:]
        class_id = int(np.argmax(class_scores))
        score = float(class_scores[class_id])

        if score < confidence:
            continue

        cx, cy, box_w, box_h = map(float, prediction[:4])

        x1 = (cx - box_w / 2 - pad_x) / scale
        y1 = (cy - box_h / 2 - pad_y) / scale
        x2 = (cx + box_w / 2 - pad_x) / scale
        y2 = (cy + box_h / 2 - pad_y) / scale

        x1 = max(0, min(original_width - 1, x1))
        y1 = max(0, min(original_height - 1, y1))
        x2 = max(0, min(original_width - 1, x2))
        y2 = max(0, min(original_height - 1, y2))

        final_width = x2 - x1
        final_height = y2 - y1

        if final_width <= 0 or final_height <= 0:
            continue

        boxes.append([
            int(x1),
            int(y1),
            int(final_width),
            int(final_height),
        ])

        scores.append(score)
        class_ids.append(class_id)

    selected = (
        cv2.dnn.NMSBoxes(
            boxes,
            scores,
            confidence,
            iou_threshold,
        )
        if boxes
        else []
    )

    annotated = image.copy()
    detections = []

    if len(selected) > 0:
        for index in np.array(selected).flatten():
            x, y, box_w, box_h = boxes[index]
            class_id = class_ids[index]
            score = scores[index]

            class_name = COCO_CLASSES[class_id]

            cv2.rectangle(
                annotated,
                (x, y),
                (x + box_w, y + box_h),
                (50, 210, 120),
                2,
            )

            cv2.putText(
                annotated,
                f"{class_name} {score:.2f}",
                (x, max(20, y - 8)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (50, 210, 120),
                2,
                cv2.LINE_AA,
            )

            detections.append({
                "class_id": class_id,
                "label": class_name,
                "confidence": round(score, 4),
                "bounding_box": {
                    "x": x,
                    "y": y,
                    "width": box_w,
                    "height": box_h,
                },
            })

    counts = {}

    for item in detections:
        label = item["label"]
        counts[label] = counts.get(label, 0) + 1

    return {
        "detections": detections,
        "object_counts": counts,
        "annotated_image": image_to_data_url(annotated),
    }


@app.post("/api/detection/analyze")
async def detect_objects(
    file: UploadFile = File(...),
    confidence: float = Query(0.25, ge=0.01, le=0.99),
    iou_threshold: float = Query(0.45, ge=0.1, le=0.9),
):
    start_time = perf_counter()
    image = await decode_image(file)

    try:
        result = run_object_detection(
            image,
            confidence,
            iou_threshold,
        )

        return {
            "status": "success",
            "model": "YOLO11n ONNX",
            "image_dimensions": {
                "width": int(image.shape[1]),
                "height": int(image.shape[0]),
            },
            "total_detections": len(result["detections"]),
            "object_counts": result["object_counts"],
            "detections": result["detections"],
            "inference_time_ms": round(
                (perf_counter() - start_time) * 1000,
                2,
            ),
            "annotated_image": result["annotated_image"],
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Object detection failed: {str(error)}",
        )


# =========================================================
# 5. VIDEO INTELLIGENCE
# =========================================================

@app.post("/api/video/analyze")
async def analyze_video(
    file: UploadFile = File(...),
    sample_interval: float = Query(1.0, ge=0.2, le=30.0),
    max_frames: int = Query(12, ge=1, le=30),
    confidence: float = Query(0.25, ge=0.01, le=0.99),
    iou_threshold: float = Query(0.45, ge=0.1, le=0.9),
):
    start_time = perf_counter()
    temporary_path = None
    capture = None

    filename = file.filename or "uploaded_video.mp4"
    extension = os.path.splitext(filename)[1].lower()

    if extension not in SUPPORTED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported video extension. "
                "Use MP4, AVI, MOV, MKV, WEBM or M4V."
            ),
        )

    try:
        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded video is empty.",
            )

        if len(contents) > MAX_VIDEO_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Maximum video size is 100 MB.",
            )

        with tempfile.NamedTemporaryFile(
            suffix=extension,
            delete=False,
        ) as temporary_file:
            temporary_file.write(contents)
            temporary_path = temporary_file.name

        del contents

        capture = cv2.VideoCapture(temporary_path)

        if not capture.isOpened():
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unable to open this video. "
                    "The file may be corrupted or use an unsupported codec."
                ),
            )

        fps = float(capture.get(cv2.CAP_PROP_FPS))
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))

        if (
            fps <= 0
            or frame_count <= 0
            or width <= 0
            or height <= 0
        ):
            raise HTTPException(
                status_code=400,
                detail="Unable to read valid video metadata.",
            )

        duration = frame_count / fps

        # Sample frames at fixed time intervals.
        sample_indices = []
        current_time = 0.0

        while (
            current_time < duration
            and len(sample_indices) < max_frames
        ):
            frame_index = min(
                int(round(current_time * fps)),
                frame_count - 1,
            )

            if (
                not sample_indices
                or frame_index != sample_indices[-1]
            ):
                sample_indices.append(frame_index)

            current_time += sample_interval

        if not sample_indices:
            sample_indices = [0]

        sampled_frames = []
        aggregate_counts = {}
        total_detections = 0
        successful_frames = 0
        detection_time_ms = 0.0

        for frame_index in sample_indices:
            capture.set(
                cv2.CAP_PROP_POS_FRAMES,
                frame_index,
            )

            success, frame = capture.read()

            if not success or frame is None:
                continue

            frame_start = perf_counter()

            result = run_object_detection(
                frame,
                confidence,
                iou_threshold,
            )

            frame_time_ms = (
                perf_counter() - frame_start
            ) * 1000

            detection_time_ms += frame_time_ms
            successful_frames += 1

            frame_counts = result["object_counts"]
            frame_detections = result["detections"]

            total_detections += len(frame_detections)

            for label, count in frame_counts.items():
                aggregate_counts[label] = (
                    aggregate_counts.get(label, 0) + count
                )

            sampled_frames.append({
                "frame_index": int(frame_index),
                "timestamp_seconds": round(
                    frame_index / fps,
                    3,
                ),
                "detections_count": len(frame_detections),
                "object_counts": frame_counts,
                "detections": frame_detections,
                "inference_time_ms": round(
                    frame_time_ms,
                    2,
                ),
                "annotated_image": result["annotated_image"],
            })

        if successful_frames == 0:
            raise HTTPException(
                status_code=400,
                detail="No readable frames could be extracted from this video.",
            )

        return {
            "status": "success",
            "model": "YOLO11n ONNX",
            "video_metadata": {
                "filename": filename,
                "duration_seconds": round(duration, 2),
                "fps": round(fps, 2),
                "width": width,
                "height": height,
                "resolution": f"{width}x{height}",
                "total_frames": frame_count,
            },
            "analysis_settings": {
                "sample_interval_seconds": sample_interval,
                "maximum_sampled_frames": max_frames,
                "confidence_threshold": confidence,
                "iou_threshold": iou_threshold,
            },
            "sampled_frames_count": successful_frames,
            "total_detections": total_detections,
            "aggregate_object_counts": aggregate_counts,
            "detection_inference_time_ms": round(
                detection_time_ms,
                2,
            ),
            "total_processing_time_ms": round(
                (perf_counter() - start_time) * 1000,
                2,
            ),
            "count_note": (
                "Object counts are summed across sampled frames. "
                "They are frame detections, not unique tracked objects."
            ),
            "sampled_frames": sampled_frames,
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Video analysis failed: {str(error)}",
        )

    finally:
        if capture is not None:
            capture.release()

        if temporary_path and os.path.exists(temporary_path):
            try:
                os.remove(temporary_path)
            except OSError:
                pass
