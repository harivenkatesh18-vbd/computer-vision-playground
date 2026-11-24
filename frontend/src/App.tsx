import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, CSSProperties } from 'react'
import {
  Activity, ArrowLeft, ArrowLeftRight, BarChart3, Box,
  CheckCircle2, CloudUpload, Cpu, Download, FileImage,
  Film, FolderOpen, Gauge, Image as ImageIcon, Layers3,
  Loader2, Menu, RotateCw, Settings2, ShieldCheck,
  Sparkles, Upload, X,
} from 'lucide-react'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const workspaces = [
  { name: 'Image Processing', description: 'Enhance and transform images', icon: ImageIcon, status: 'Available', detail: '12 image-processing algorithms' },
  { name: 'Object Detection', description: 'Detect and identify objects', icon: Box, status: 'Available', detail: 'YOLO11n detection, confidence scores and counting' },
  { name: 'Color Intelligence', description: 'Explore color spaces and masks', icon: Layers3, status: 'Available', detail: 'Color analysis, dominant colors and segmentation' },
  { name: 'Shape Analysis', description: 'Analyze contours and geometry', icon: Activity, status: 'Available', detail: 'Contours, shape measurements and geometry' },
  { name: 'Video Intelligence', description: 'Analyze video frames with object detection', icon: Film, status: 'Available', detail: 'Video metadata, sampled-frame detection and object counts' },
  { name: 'Experiments', description: 'Compare algorithms and results', icon: BarChart3, status: 'Available', detail: 'Run and compare 12 image-processing algorithms' },
]

const operations = [
  { id: 'grayscale', name: 'Grayscale', description: 'Convert to intensity image' },
  { id: 'blur', name: 'Gaussian Blur', description: 'Smooth image and reduce noise' },
  { id: 'median', name: 'Median Blur', description: 'Remove impulse noise' },
  { id: 'bilateral', name: 'Bilateral Filter', description: 'Smooth while preserving edges' },
  { id: 'edges', name: 'Canny Edges', description: 'Detect image boundaries' },
  { id: 'sharpen', name: 'Sharpen', description: 'Enhance image details' },
  { id: 'threshold', name: 'Binary Threshold', description: 'Separate foreground and background' },
  { id: 'adaptive-threshold', name: 'Adaptive Threshold', description: 'Local intensity thresholding' },
  { id: 'equalize', name: 'Histogram Equalization', description: 'Improve grayscale contrast' },
  { id: 'clahe', name: 'CLAHE', description: 'Local adaptive contrast enhancement' },
  { id: 'rotate', name: 'Rotate', description: 'Rotate image by a chosen angle' },
  { id: 'flip', name: 'Flip', description: 'Mirror or invert the image' },
] as const

type Operation = typeof operations[number]['id']
type ExperimentResult = { operation: Operation; name: string; imageUrl: string; timeMs: number; width: number; height: number }
type ColorSpace = 'RGB' | 'HSV' | 'LAB'

type DominantColor = { hex: string; rgb: number[]; percentage: number }
type ColorAnalysis = {
  color_space?: string
  image_dimensions?: { width: number; height: number }
  channel_means?: Record<string, number>
  dominant_colors?: DominantColor[]
  sampled_pixels?: number
}

type Shape = {
  id: number
  shape: string
  area: number
  perimeter: number
  vertices: number
  bounding_box: { x: number; y: number; width: number; height: number }
  centroid: { x: number; y: number }
  aspect_ratio: number
  circularity: number
  solidity: number
}

type ShapeResult = {
  status: string
  image_dimensions: { width: number; height: number }
  total_contours: number
  detected_objects: number
  threshold_mode: string
  shapes: Shape[]
  annotated_image: string
}

type Detection = {
  class_name?: string
  class?: string | number
  label?: string
  confidence?: number
  score?: number
  bbox?: number[]
  bounding_box?: number[] | Record<string, number>
  [key: string]: unknown
}

type DetectionResult = {
  status: string
  detections: Detection[]
  object_counts: Record<string, number>
  inference_time_ms: number
  annotated_image: string
}

type VideoFrame = {
  frame_index: number
  timestamp_seconds: number
  detections_count: number
  object_counts: Record<string, number>
  detections: Detection[]
  inference_time_ms: number
  annotated_image: string
}

type VideoResult = {
  status: string
  model: string
  video_metadata: {
    filename: string
    duration_seconds: number
    fps: number
    width: number
    height: number
    resolution: string
    total_frames: number
  }
  analysis_settings: {
    sample_interval: number
    max_frames: number
    confidence: number
    iou_threshold: number
  }
  sampled_frames_count: number
  total_detections: number
  aggregate_object_counts: Record<string, number>
  detection_inference_time_ms: number
  total_processing_time_ms: number
  count_note: string
  sampled_frames: VideoFrame[]
}

const landingStyle: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#f5f7fc', color: '#172746', fontFamily: 'inherit' },
  nav: { height: 76, padding: '0 7%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderBottom: '1px solid #e7ebf3' },
  logo: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 21, fontWeight: 750, color: '#172746' },
  logoIcon: { width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: '#4358dc', color: '#fff' },
  hero: { maxWidth: 1120, margin: '0 auto', padding: '85px 24px 65px', textAlign: 'center' },
  eyebrow: { color: '#5369dc', fontSize: 12, fontWeight: 750, letterSpacing: 2 },
  heading: { maxWidth: 850, margin: '22px auto 18px', fontSize: 'clamp(38px, 6vw, 64px)', lineHeight: 1.1, letterSpacing: '-2px', fontWeight: 800 },
  description: { maxWidth: 670, margin: '0 auto', color: '#71809b', fontSize: 17, lineHeight: 1.8 },
  primary: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 30, padding: '15px 25px', border: 0, borderRadius: 10, background: '#4358dc', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 22px rgba(67,88,220,.2)' },
  section: { maxWidth: 1120, margin: '0 auto', padding: '20px 24px 80px' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 18, marginTop: 28 },
  card: { padding: 23, border: '1px solid #e3e8f1', borderRadius: 15, background: '#fff', textAlign: 'left' },
}

const panelCard: CSSProperties = { padding: 24 }
const fieldStyle: CSSProperties = { display: 'block', marginTop: 7, padding: 10, borderRadius: 8, border: '1px solid #dce1eb', minWidth: 130, background: '#fff', color: '#172746' }
const rangeStyle: CSSProperties = { display: 'block', width: '100%', marginTop: 7 }

function App() {
  const [page, setPage] = useState<'home' | 'workspace'>('home')
  const [activeWorkspace, setActiveWorkspace] = useState('Image Processing')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState('')
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [selectedOperation, setSelectedOperation] = useState<Operation>('grayscale')
  const [kernelSize, setKernelSize] = useState(5)
  const [thresholdValue, setThresholdValue] = useState(127)
  const [angle, setAngle] = useState(90)
  const [clipLimit, setClipLimit] = useState(2)
  const [flipCode, setFlipCode] = useState(1)

  const [isProcessing, setIsProcessing] = useState(false)
  const [processedUrl, setProcessedUrl] = useState<string | null>(null)
  const [processedOperation, setProcessedOperation] = useState('')
  const [processingError, setProcessingError] = useState('')
  const [processingTime, setProcessingTime] = useState<number | null>(null)
  const [showComparison, setShowComparison] = useState(false)

  const [experimentOperations, setExperimentOperations] = useState<Operation[]>(['grayscale', 'blur', 'edges', 'sharpen'])
  const [experimentResults, setExperimentResults] = useState<ExperimentResult[]>([])
  const [isRunningExperiments, setIsRunningExperiments] = useState(false)
  const [experimentProgress, setExperimentProgress] = useState('')
  const [experimentError, setExperimentError] = useState('')

  const [colorSpace, setColorSpace] = useState<ColorSpace>('RGB')
  const [dominantCount, setDominantCount] = useState(5)
  const [colorAnalysis, setColorAnalysis] = useState<ColorAnalysis | null>(null)
  const [isAnalyzingColor, setIsAnalyzingColor] = useState(false)
  const [colorError, setColorError] = useState('')

  const [hueMin, setHueMin] = useState(0)
  const [hueMax, setHueMax] = useState(179)
  const [saturationMin, setSaturationMin] = useState(50)
  const [saturationMax, setSaturationMax] = useState(255)
  const [valueMin, setValueMin] = useState(50)
  const [valueMax, setValueMax] = useState(255)
  const [segmentedUrl, setSegmentedUrl] = useState<string | null>(null)
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [segmentationError, setSegmentationError] = useState('')

  const [thresholdMode, setThresholdMode] = useState('otsu')
  const [shapeThreshold, setShapeThreshold] = useState(127)
  const [minArea, setMinArea] = useState(100)
  const [epsilonFactor, setEpsilonFactor] = useState(0.02)
  const [shapeResult, setShapeResult] = useState<ShapeResult | null>(null)
  const [isAnalyzingShapes, setIsAnalyzingShapes] = useState(false)
  const [shapeError, setShapeError] = useState('')
  const [selectedShape, setSelectedShape] = useState<number | null>(null)

  const [confidence, setConfidence] = useState(0.25)
  const [iouThreshold, setIouThreshold] = useState(0.45)
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionError, setDetectionError] = useState('')

  // Video Intelligence
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [sampleInterval, setSampleInterval] = useState(1)
  const [maxFrames, setMaxFrames] = useState(10)
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null)
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false)
  const [videoError, setVideoError] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!imageFile) {
      setImageUrl(null)
      setImageDimensions('')
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImageUrl(url)
    const img = new Image()
    img.onload = () => setImageDimensions(`${img.naturalWidth} × ${img.naturalHeight}`)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  useEffect(() => {
    return () => {
      if (processedUrl) URL.revokeObjectURL(processedUrl)
    }
  }, [processedUrl])

  useEffect(() => {
    return () => {
      if (segmentedUrl) URL.revokeObjectURL(segmentedUrl)
    }
  }, [segmentedUrl])

  useEffect(() => {
    if (!videoFile) {
      setVideoUrl(null)
      return
    }
    const url = URL.createObjectURL(videoFile)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [videoFile])

  const resetProcessing = () => {
    requestIdRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setIsProcessing(false)
    setProcessedUrl(null)
    setProcessedOperation('')
    setProcessingError('')
    setProcessingTime(null)
    setShowComparison(false)
  }

  const resetColorResults = () => {
    setColorAnalysis(null)
    setColorError('')
    setSegmentedUrl(null)
    setSegmentationError('')
  }

  const resetShapeResults = () => {
    setShapeResult(null)
    setShapeError('')
    setSelectedShape(null)
  }

  const resetDetectionResults = () => {
    setDetectionResult(null)
    setDetectionError('')
  }

  const handleFile = (file?: File) => {
    setError('')
    setProcessingError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Maximum supported file size is 20 MB.')
      return
    }
    resetProcessing()
    resetColorResults()
    resetShapeResults()
    resetDetectionResults()
    setImageFile(file)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  const clearImage = () => {
    resetProcessing()
    resetColorResults()
    resetShapeResults()
    resetDetectionResults()
    setImageFile(null)
    setError('')
  }

  const openWorkspace = (name: string) => {
    setActiveWorkspace(name)
    setPage('workspace')
    setSidebarOpen(false)
  }

  const currentWorkspace = workspaces.find(w => w.name === activeWorkspace)

  const videoObjectClasses = [...new Set([
    ...Object.keys(videoResult?.aggregate_object_counts ?? {}),
    ...(videoResult?.sampled_frames.flatMap(frame => Object.keys(frame.object_counts ?? {})) ?? []),
  ])].sort()

  const processImage = async () => {
    if (!imageFile || isProcessing) return
    const currentRequest = ++requestIdRef.current
    const controller = new AbortController()
    abortRef.current = controller
    setIsProcessing(true)
    setProcessingError('')
    setProcessedUrl(null)
    setProcessingTime(null)

    const params = new URLSearchParams()
    if (['blur', 'median', 'bilateral', 'adaptive-threshold'].includes(selectedOperation)) params.set('kernel_size', String(kernelSize))
    if (selectedOperation === 'threshold') params.set('threshold_value', String(thresholdValue))
    if (selectedOperation === 'rotate') params.set('angle', String(angle))
    if (selectedOperation === 'clahe') params.set('clip_limit', String(clipLimit))
    if (selectedOperation === 'flip') params.set('flip_code', String(flipCode))

    const formData = new FormData()
    formData.append('file', imageFile)
    const started = performance.now()

    try {
      const response = await fetch(`${API}/api/process/${selectedOperation}?${params}`, {
        method: 'POST', body: formData, signal: controller.signal,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Processing failed (${response.status}).`)
      }
      const blob = await response.blob()
      if (!blob.type.includes('image')) throw new Error('The server returned an unexpected response.')
      const url = URL.createObjectURL(blob)
      if (currentRequest !== requestIdRef.current) {
        URL.revokeObjectURL(url)
        return
      }
      setProcessedUrl(url)
      setProcessedOperation(selectedOperation)
      setProcessingTime(performance.now() - started)
      setShowComparison(false)
    } catch (err) {
      if (currentRequest === requestIdRef.current && !(err instanceof DOMException && err.name === 'AbortError')) {
        setProcessingError(err instanceof Error ? err.message : 'Unable to connect to VisionLab API.')
      }
    } finally {
      if (currentRequest === requestIdRef.current) {
        setIsProcessing(false)
        abortRef.current = null
      }
    }
  }

  const runExperiments = async () => {
    if (!imageFile || experimentOperations.length < 2 || isRunningExperiments) return
    setIsRunningExperiments(true)
    setExperimentError('')
    setExperimentResults([])
    const completed: ExperimentResult[] = []
    try {
      // Run one at a time to avoid overloading a local CPU backend.
      for (let index = 0; index < experimentOperations.length; index += 1) {
        const operation = experimentOperations[index]
        setExperimentProgress(`Running ${index + 1} of ${experimentOperations.length}: ${operations.find(item => item.id === operation)?.name ?? operation}`)
        const params = new URLSearchParams()
        if (['blur', 'median', 'bilateral', 'adaptive-threshold'].includes(operation)) params.set('kernel_size', '5')
        if (operation === 'threshold') params.set('threshold_value', '127')
        if (operation === 'rotate') params.set('angle', '90')
        if (operation === 'clahe') params.set('clip_limit', '2')
        if (operation === 'flip') params.set('flip_code', '1')
        const body = new FormData()
        body.append('file', imageFile)
        const started = performance.now()
        const response = await fetch(`${API}/api/process/${operation}?${params}`, { method: 'POST', body })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(`${operations.find(item => item.id === operation)?.name ?? operation}: ${data.detail || `Request failed (${response.status})`}`)
        }
        const blob = await response.blob()
        if (!blob.type.includes('image')) throw new Error(`${operation} returned an unsupported response.`)
        const imageUrl = URL.createObjectURL(blob)
        const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
          image.onerror = () => reject(new Error(`Could not read ${operation} output dimensions.`))
          image.src = imageUrl
        })
        completed.push({ operation, name: operations.find(item => item.id === operation)?.name ?? operation, imageUrl, timeMs: performance.now() - started, ...dimensions })
        setExperimentResults([...completed])
      }
    } catch (err) {
      setExperimentError(err instanceof Error ? err.message : 'Experiment run failed. Check that the VisionLab API is running.')
    } finally {
      setIsRunningExperiments(false)
      setExperimentProgress('')
    }
  }

  const toggleExperimentOperation = (operation: Operation) => {
    setExperimentOperations(current => current.includes(operation) ? current.filter(item => item !== operation) : [...current, operation])
    setExperimentResults(current => { current.forEach(result => URL.revokeObjectURL(result.imageUrl)); return [] })
  }

  const downloadExperimentResult = (result: ExperimentResult) => {
    const link = document.createElement('a')
    link.href = result.imageUrl
    link.download = `visionlab-${result.operation}.png`
    link.click()
  }

  const analyzeColors = async () => {
    if (!imageFile || isAnalyzingColor) return
    setIsAnalyzingColor(true)
    setColorError('')
    setColorAnalysis(null)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      const params = new URLSearchParams({ color_space: colorSpace, colors: String(dominantCount) })
      const response = await fetch(`${API}/api/color/analyze?${params}`, { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Color analysis failed.')
      }
      const result = await response.json() as ColorAnalysis
      if (!result.channel_means || !Array.isArray(result.dominant_colors)) {
        throw new Error('The color analysis response is missing expected fields.')
      }
      setColorAnalysis(result)
    } catch (err) {
      setColorError(err instanceof Error ? err.message : 'Unable to analyze colors.')
    } finally {
      setIsAnalyzingColor(false)
    }
  }

  const segmentColors = async () => {
    if (!imageFile || isSegmenting) return
    setIsSegmenting(true)
    setSegmentationError('')
    setSegmentedUrl(null)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      const params = new URLSearchParams({
        hue_min: String(hueMin), hue_max: String(hueMax),
        saturation_min: String(saturationMin), saturation_max: String(saturationMax),
        value_min: String(valueMin), value_max: String(valueMax),
      })
      const response = await fetch(`${API}/api/color/segment?${params}`, { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Color segmentation failed.')
      }
      const blob = await response.blob()
      if (!blob.type.includes('image')) throw new Error('The server returned an unexpected image format.')
      setSegmentedUrl(URL.createObjectURL(blob))
    } catch (err) {
      setSegmentationError(err instanceof Error ? err.message : 'Unable to segment colors.')
    } finally {
      setIsSegmenting(false)
    }
  }

  const analyzeShapes = async () => {
    if (!imageFile || isAnalyzingShapes) return
    setIsAnalyzingShapes(true)
    setShapeError('')
    setShapeResult(null)
    setSelectedShape(null)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      const params = new URLSearchParams({
        threshold_mode: thresholdMode,
        threshold_value: String(shapeThreshold),
        min_area: String(minArea),
        epsilon_factor: String(epsilonFactor),
      })
      const response = await fetch(`${API}/api/shapes/analyze?${params}`, { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Shape analysis failed (${response.status}).`)
      }
      const result = await response.json() as ShapeResult
      if (!result.annotated_image || !Array.isArray(result.shapes)) {
        throw new Error('The shape analysis response is missing expected fields.')
      }
      setShapeResult(result)
    } catch (err) {
      setShapeError(err instanceof Error ? err.message : 'Unable to analyze shapes.')
    } finally {
      setIsAnalyzingShapes(false)
    }
  }

  const analyzeObjects = async () => {
    if (!imageFile || isDetecting) return
    setIsDetecting(true)
    setDetectionError('')
    setDetectionResult(null)
    try {
      const formData = new FormData()
      formData.append('file', imageFile)
      const params = new URLSearchParams({
        confidence: String(confidence),
        iou_threshold: String(iouThreshold),
      })
      const response = await fetch(`${API}/api/detection/analyze?${params}`, { method: 'POST', body: formData })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Object detection failed (${response.status}).`)
      }
      const result = await response.json() as DetectionResult
      if (!Array.isArray(result.detections) || !result.annotated_image) {
        throw new Error('The detection response is missing expected fields.')
      }
      setDetectionResult(result)
    } catch (err) {
      setDetectionError(err instanceof Error ? err.message : 'Unable to detect objects.')
    } finally {
      setIsDetecting(false)
    }
  }

  // Video upload and validation
  const handleVideoFile = (file?: File) => {
    setVideoError('')
    setVideoResult(null)
    if (!file) return
    const allowed = /\.(mp4|avi|mov|mkv|webm|m4v)$/i
    if (!allowed.test(file.name)) {
      setVideoError('Unsupported format. Select MP4, AVI, MOV, MKV, WEBM or M4V.')
      return
    }
    if (file.size > 100 * 1024 * 1024) {
      setVideoError('Maximum supported video file size is 100 MB.')
      return
    }
    setVideoFile(file)
  }

  const handleVideoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleVideoFile(event.target.files?.[0])
    event.target.value = ''
  }

  const analyzeVideo = async () => {
    if (!videoFile || isAnalyzingVideo) return
    setIsAnalyzingVideo(true)
    setVideoError('')
    setVideoResult(null)
    try {
      const formData = new FormData()
      formData.append('file', videoFile)
      const params = new URLSearchParams({
        sample_interval: String(sampleInterval),
        max_frames: String(maxFrames),
        confidence: String(confidence),
        iou_threshold: String(iouThreshold),
      })
      const response = await fetch(`${API}/api/video/analyze?${params}`, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Video analysis failed (${response.status}).`)
      }
      const result = await response.json() as VideoResult
      if (!Array.isArray(result.sampled_frames) || !result.video_metadata) {
        throw new Error('The video analysis response is missing expected fields.')
      }
      setVideoResult(result)
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Unable to analyze video. Check that the backend is running.')
    } finally {
      setIsAnalyzingVideo(false)
    }
  }

  const downloadUrl = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const downloadResult = () => {
    if (processedUrl) downloadUrl(processedUrl, `visionlab-${processedOperation}.png`)
  }
  const downloadSegmentation = () => {
    if (segmentedUrl) downloadUrl(segmentedUrl, 'visionlab-color-segmentation.png')
  }
  const downloadShapeImage = () => {
    if (shapeResult?.annotated_image) downloadUrl(shapeResult.annotated_image, 'visionlab-shape-analysis.png')
  }
  const downloadDetectionImage = () => {
    if (detectionResult?.annotated_image) downloadUrl(detectionResult.annotated_image, 'visionlab-object-detection.png')
  }
  const downloadVideoFrame = (frame: VideoFrame) => {
    if (frame.annotated_image) downloadUrl(frame.annotated_image, `visionlab-frame-${frame.frame_index}.png`)
  }

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`
  }

  const sectionTitle = (title: string, description: string, icon?: React.ReactNode) => (
    <div className="panel-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      {icon}
    </div>
  )

  // Landing page
  if (page === 'home') {
    return (
      <div style={landingStyle.page}>
        <header style={landingStyle.nav}>
          <div style={landingStyle.logo}>
            <div style={landingStyle.logoIcon}><Cpu size={23} /></div>
            <div>
              VisionLab
              <div style={{ fontSize: 9, letterSpacing: 2, fontWeight: 600, color: '#8190aa', marginTop: 3 }}>VISUAL INTELLIGENCE</div>
            </div>
          </div>
          <button style={{ ...landingStyle.primary, marginTop: 0, padding: '12px 19px' }} onClick={() => openWorkspace('Image Processing')}>
            Get Started <ArrowLeft size={16} />
          </button>
        </header>
        <section style={landingStyle.hero}>
          <div style={landingStyle.eyebrow}>COMPUTER VISION & VISUAL INTELLIGENCE</div>
          <h1 style={landingStyle.heading}>See beyond the image.<br /><span style={{ color: '#5369dc' }}>Understand the visual world.</span></h1>
          <p style={landingStyle.description}>VisionLab is a computer vision workspace for processing, analyzing and understanding images and video through practical computer vision algorithms.</p>
          <button style={landingStyle.primary} onClick={() => openWorkspace('Image Processing')}><Sparkles size={18} /> Explore VisionLab</button>
        </section>
        <section style={landingStyle.section}>
          <div style={{ textAlign: 'center' }}>
            <div style={landingStyle.eyebrow}>EXPLORE THE PLATFORM</div>
            <h2 style={{ fontSize: 30, margin: '12px 0' }}>Computer vision workspaces</h2>
            <p style={{ color: '#71809b', lineHeight: 1.7 }}>Explore the available computer vision tools.</p>
          </div>
          <div style={landingStyle.cards}>
            {workspaces.map(workspace => {
              const Icon = workspace.icon
              const available = workspace.status === 'Available'
              return (
                <div key={workspace.name} style={landingStyle.card}>
                  <div style={{ width: 43, height: 43, display: 'grid', placeItems: 'center', borderRadius: 12, background: available ? '#edf0ff' : '#f1f3f7', color: available ? '#5369dc' : '#8290a8' }}>
                    <Icon size={21} />
                  </div>
                  <h3 style={{ margin: '17px 0 7px', fontSize: 17 }}>{workspace.name}</h3>
                  <p style={{ color: '#71809b', fontSize: 13, lineHeight: 1.6, minHeight: 42 }}>{workspace.detail}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: available ? '#168b70' : '#8792a5' }}>{available ? 'AVAILABLE NOW' : 'PLANNED'}</span>
                    {available && <button onClick={() => openWorkspace(workspace.name)} style={{ border: 0, background: 'transparent', color: '#5369dc', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Open <ArrowLeft size={13} /></button>}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        <footer style={{ padding: 25, textAlign: 'center', color: '#8290a8', borderTop: '1px solid #e4e9f1', fontSize: 12 }}>
          VisionLab · Computer Vision & Visual Intelligence Platform
        </footer>
      </div>
    )
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Cpu size={23} /></div>
          <div className="brand-copy">
            <span className="brand-name">VisionLab</span>
            <span className="brand-subtitle">VISUAL INTELLIGENCE</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="sidebar-section">
          <span className="section-label">WORKSPACE</span>
          <nav className="nav-list">
            {workspaces.map(workspace => {
              const Icon = workspace.icon
              const available = workspace.status === 'Available'
              return (
                <button key={workspace.name} className={`nav-item ${activeWorkspace === workspace.name ? 'active' : ''}`} onClick={() => openWorkspace(workspace.name)} title={available ? 'Available' : 'Planned feature'}>
                  <Icon size={18} />
                  <span>{workspace.name}</span>
                  {activeWorkspace === workspace.name && <span className="active-indicator" />}
                  {!available && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#9aa4b5' }}>SOON</span>}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><Sparkles size={17} /></div>
            <div><strong>Explore and experiment</strong><p>Build your visual intelligence workflow.</p></div>
          </div>
          <div className="profile">
            <div className="profile-avatar">VL</div>
            <div className="profile-info"><strong>VisionLab</strong><span>Local workspace</span></div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <button className="mobile-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div className="breadcrumb">
              <button onClick={() => setPage('home')} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Home</button>
              <span className="breadcrumb-divider">/</span>
              <strong>{activeWorkspace}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="system-status"><span className="status-dot" /> Local workspace</div>
            <div className="top-avatar">VL</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> COMPUTER VISION WORKSPACE</div>
              <h1>{activeWorkspace}</h1>
              <p>{currentWorkspace?.description}. Explore the available tools and algorithms.</p>
            </div>
            <div className="heading-tag"><ShieldCheck size={16} /><span>Local processing workspace</span></div>
          </section>

          {/* IMAGE PROCESSING */}
          {activeWorkspace === 'Image Processing' && (
            <>
              <section className="overview-grid">
                <div className="overview-card"><div className="overview-icon blue"><ImageIcon size={19} /></div><div><span className="overview-label">CURRENT INPUT</span><strong>{imageFile ? '1 image loaded' : 'No image loaded'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon violet"><Layers3 size={19} /></div><div><span className="overview-label">AVAILABLE OPERATIONS</span><strong>12 algorithms</strong></div></div>
                <div className="overview-card"><div className="overview-icon teal"><Gauge size={19} /></div><div><span className="overview-label">PROCESSING STATUS</span><strong>{isProcessing ? 'Processing…' : processedUrl ? 'Completed' : imageFile ? 'Input ready' : 'Waiting for input'}</strong></div></div>
              </section>

              <div className="workspace-layout">
                <section className="panel input-panel">
                  <div className="panel-heading">
                    <div><div className="panel-title-row"><h2>Input image</h2><span className="small-badge">IMAGE INPUT</span></div><p>Upload an image to start processing.</p></div>
                    {imageFile && <button className="text-button" onClick={clearImage}><X size={15} /> Remove</button>}
                  </div>
                  {!imageFile ? (
                    <div className={`upload-zone ${isDragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                      <div className="upload-illustration"><div className="upload-icon-back"><FileImage size={31} /></div><div className="upload-cloud"><CloudUpload size={23} /></div></div>
                      <h3>Drop your image here</h3><p>Drag and drop an image, or browse files from your device.</p>
                      <button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={17} /> Browse images</button>
                      <input ref={inputRef} type="file" accept="image/*" onChange={handleInputChange} hidden />
                      <div className="upload-formats"><span>JPG</span><span>PNG</span><span>WEBP</span><span>AVIF</span><i /> Maximum 20 MB</div>
                    </div>
                  ) : (
                    <div className="preview-area">
                      <div className="preview-toolbar"><div className="preview-file-name"><FileImage size={16} /><span title={imageFile.name}>{imageFile.name}</span></div><span className="loaded-label">INPUT LOADED</span></div>
                      <div className="image-preview">{imageUrl && <img src={imageUrl} alt="Original uploaded image" />}</div>
                      <div className="file-details">
                        <div><span>Dimensions</span><strong>{imageDimensions || 'Reading…'}</strong></div>
                        <div><span>File size</span><strong>{(imageFile.size / 1048576).toFixed(2)} MB</strong></div>
                        <div><span>Format</span><strong>{imageFile.type.split('/')[1]?.toUpperCase() || 'IMAGE'}</strong></div>
                      </div>
                      <button className="change-image-button" onClick={() => inputRef.current?.click()}><FolderOpen size={16} /> Choose another image</button>
                      <input ref={inputRef} type="file" accept="image/*" onChange={handleInputChange} hidden />
                    </div>
                  )}
                  {error && <div className="error-message">{error}</div>}
                  {processedUrl && imageUrl && (
                    <div className="result-panel">
                      <div className="panel-heading">
                        <div><div className="panel-title-row"><h2>Processed result</h2><span className="loaded-label">COMPLETE</span></div><p>{operations.find(op => op.id === processedOperation)?.name} · PNG output</p></div>
                        <button className="primary-button" onClick={downloadResult}><Download size={16} /> Download</button>
                      </div>
                      <div className="result-toolbar"><button className="text-button comparison-active" onClick={() => setShowComparison(value => !value)}><ArrowLeftRight size={15} /> {showComparison ? 'Show processed image' : 'Compare original'}</button></div>
                      <div className="result-image"><img src={showComparison ? imageUrl : processedUrl} alt={showComparison ? 'Original image' : 'Processed image'} /></div>
                      <div className="result-footer"><span><CheckCircle2 size={15} />{showComparison ? 'Viewing original image' : 'Processing completed successfully'}</span><span>{processingTime !== null ? `${(processingTime / 1000).toFixed(2)} seconds` : ''}</span></div>
                    </div>
                  )}
                </section>

                <aside className="panel settings-panel">
                  <div className="panel-heading"><div><div className="panel-title-row"><h2>Processing toolbox</h2></div><p>Select an image-processing algorithm.</p></div><Settings2 size={19} className="muted-icon" /></div>
                  <div className="operation-list">
                    {operations.map(operation => (
                      <button key={operation.id} className={`operation-option ${selectedOperation === operation.id ? 'selected' : ''}`} onClick={() => { setSelectedOperation(operation.id); if (operation.id === 'adaptive-threshold' && kernelSize < 3) setKernelSize(3); setProcessingError('') }} disabled={isProcessing}>
                        <span className="operation-option-copy"><strong>{operation.name}</strong><span>{operation.description}</span></span>
                        {selectedOperation === operation.id && <CheckCircle2 size={17} />}
                      </button>
                    ))}
                  </div>
                  <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid #e8ebf2' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Parameters</h3>
                    {['blur', 'median', 'bilateral', 'adaptive-threshold'].includes(selectedOperation) && (
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>Kernel size: <strong>{kernelSize}</strong><input style={rangeStyle} type="range" min={selectedOperation === 'adaptive-threshold' ? 3 : 1} max="51" step="2" value={kernelSize} onChange={event => setKernelSize(Number(event.target.value))} /><span style={{ color: '#7b8499' }}>Odd values only · 1–51</span></label>
                    )}
                    {selectedOperation === 'threshold' && <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>Threshold value: <strong>{thresholdValue}</strong><input style={rangeStyle} type="range" min="0" max="255" value={thresholdValue} onChange={event => setThresholdValue(Number(event.target.value))} /></label>}
                    {selectedOperation === 'rotate' && <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>Rotation angle: <strong>{angle}°</strong><input style={rangeStyle} type="range" min="-180" max="180" value={angle} onChange={event => setAngle(Number(event.target.value))} /></label>}
                    {selectedOperation === 'clahe' && <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>Contrast limit: <strong>{clipLimit.toFixed(1)}</strong><input style={rangeStyle} type="range" min="0.1" max="10" step="0.1" value={clipLimit} onChange={event => setClipLimit(Number(event.target.value))} /></label>}
                    {selectedOperation === 'flip' && <label style={{ display: 'block', fontSize: 12, marginBottom: 14 }}>Flip direction<select style={{ ...fieldStyle, width: '100%' }} value={flipCode} onChange={event => setFlipCode(Number(event.target.value))}><option value={1}>Horizontal</option><option value={0}>Vertical</option><option value={-1}>Both axes</option></select></label>}
                    <button className="primary-button process-button" onClick={processImage} disabled={!imageFile || isProcessing}>{isProcessing ? <><Loader2 size={17} className="spin-icon" /> Processing…</> : <><RotateCw size={17} /> Run operation</>}</button>
                    {processingError && <div className="error-message" style={{ marginTop: 12 }}>{processingError}</div>}
                    {!imageFile && <p style={{ color: '#7b8499', fontSize: 11, textAlign: 'center', marginTop: 10 }}>Upload an image to enable processing.</p>}
                  </div>
                </aside>
              </div>
            </>
          )}

          {/* COLOR INTELLIGENCE */}
          {activeWorkspace === 'Color Intelligence' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="panel" style={panelCard}>
                {sectionTitle('Color analysis input', 'Upload an image to analyze its color properties.')}
                {!imageFile ? (
                  <div className="upload-zone" style={{ padding: 30, marginTop: 18 }}>
                    <CloudUpload size={32} color="#5369dc" /><h3>Upload an image</h3><p>Choose an image to begin color analysis.</p>
                    <button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={16} /> Browse images</button>
                    <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleInputChange} />
                    {error && <div className="error-message">{error}</div>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'center', marginTop: 18 }}>
                    <div className="image-preview">{imageUrl && <img src={imageUrl} alt="Color analysis input" />}</div>
                    <div><strong style={{ overflowWrap: 'anywhere' }}>{imageFile.name}</strong><p style={{ color: '#71809b', fontSize: 13 }}>{imageDimensions}</p><p style={{ color: '#71809b', fontSize: 13 }}>{(imageFile.size / 1048576).toFixed(2)} MB</p><button className="text-button" onClick={() => inputRef.current?.click()}><FolderOpen size={15} /> Change image</button><button className="text-button" onClick={clearImage}><X size={15} /> Remove image</button><input ref={inputRef} type="file" accept="image/*" hidden onChange={handleInputChange} /></div>
                  </div>
                )}
              </section>

              <section className="panel" style={panelCard}>
                {sectionTitle('Color space analysis', 'Analyze channel statistics and extract dominant colors.', <Layers3 size={20} color="#5369dc" />)}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, margin: '20px 0' }}>
                  <label style={{ fontSize: 13 }}>Color space<select value={colorSpace} onChange={event => { setColorSpace(event.target.value as ColorSpace); setColorAnalysis(null); setColorError('') }} style={fieldStyle}><option value="RGB">RGB</option><option value="HSV">HSV</option><option value="LAB">LAB</option></select></label>
                  <label style={{ fontSize: 13 }}>Dominant colors<select value={dominantCount} onChange={event => { setDominantCount(Number(event.target.value)); setColorAnalysis(null); setColorError('') }} style={fieldStyle}>{[3, 4, 5, 6, 8, 10].map(count => <option key={count} value={count}>{count} colors</option>)}</select></label>
                </div>
                <button className="primary-button" onClick={analyzeColors} disabled={!imageFile || isAnalyzingColor}>{isAnalyzingColor ? <><Loader2 size={16} className="spin-icon" /> Analyzing…</> : <><BarChart3 size={16} /> Analyze colors</>}</button>
                {colorError && <div className="error-message" style={{ marginTop: 15 }}>{colorError}</div>}
                {colorAnalysis && (
                  <div style={{ marginTop: 25 }}>
                    <h3>Channel statistics — {colorAnalysis.color_space || colorSpace}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 15 }}>
                      {Object.entries(colorAnalysis.channel_means || {}).map(([channel, value]) => <div key={channel} style={{ padding: 16, background: '#f6f8fd', border: '1px solid #e6eaf2', borderRadius: 10 }}><span style={{ color: '#71809b', fontSize: 12 }}>{channel}</span><div style={{ fontSize: 23, fontWeight: 750, marginTop: 6 }}>{Number(value).toFixed(2)}</div></div>)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 18, color: '#71809b', fontSize: 12 }}><span>Image: {colorAnalysis.image_dimensions?.width ?? '—'} × {colorAnalysis.image_dimensions?.height ?? '—'}</span><span>Sampled pixels: {colorAnalysis.sampled_pixels?.toLocaleString() ?? 'Not provided'}</span></div>
                    <h3 style={{ marginTop: 25 }}>Dominant color palette</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 12, marginTop: 15 }}>
                      {(colorAnalysis.dominant_colors || []).map((color, index) => <div key={`${color.hex}-${index}`} style={{ border: '1px solid #e6eaf2', borderRadius: 10, overflow: 'hidden' }}><div style={{ height: 75, background: color.hex }} /><div style={{ padding: 10 }}><strong style={{ fontSize: 13 }}>{color.hex}</strong><p style={{ color: '#71809b', fontSize: 12, margin: '5px 0 0' }}>{Number(color.percentage).toFixed(2)}%</p><p style={{ color: '#71809b', fontSize: 11, margin: '3px 0 0' }}>RGB({(color.rgb || []).join(', ')})</p></div></div>)}
                    </div>
                  </div>
                )}
              </section>

              <section className="panel" style={panelCard}>
                {sectionTitle('HSV color segmentation', 'Extract image regions using adjustable HSV thresholds.', <Settings2 size={20} color="#5369dc" />)}
                <p style={{ color: '#71809b', fontSize: 12, marginTop: 15, lineHeight: 1.7 }}>Hue ranges from 0–179. Saturation and Value range from 0–255. Hue supports wrap-around ranges for red detection.</p>
                {[
                  { name: 'Hue', min: hueMin, max: hueMax, setMin: setHueMin, setMax: setHueMax, limit: 179, wrap: true },
                  { name: 'Saturation', min: saturationMin, max: saturationMax, setMin: setSaturationMin, setMax: setSaturationMax, limit: 255, wrap: false },
                  { name: 'Value', min: valueMin, max: valueMax, setMin: setValueMin, setMax: setValueMax, limit: 255, wrap: false },
                ].map(control => (
                  <div key={control.name} style={{ padding: '16px 0', borderBottom: '1px solid #edf0f5' }}>
                    <strong style={{ fontSize: 13 }}>{control.name}</strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#71809b', marginTop: 10 }}><span>Minimum: {control.min}</span><span>Maximum: {control.max}</span></div>
                    <label style={{ display: 'block', fontSize: 11, marginTop: 10 }}>Minimum<input type="range" min="0" max={control.limit} value={control.min} onChange={event => control.setMin(control.wrap ? Number(event.target.value) : Math.min(Number(event.target.value), control.max))} style={rangeStyle} /></label>
                    <label style={{ display: 'block', fontSize: 11, marginTop: 10 }}>Maximum<input type="range" min="0" max={control.limit} value={control.max} onChange={event => control.setMax(control.wrap ? Number(event.target.value) : Math.max(Number(event.target.value), control.min))} style={rangeStyle} /></label>
                  </div>
                ))}
                <button className="primary-button" style={{ marginTop: 20 }} onClick={segmentColors} disabled={!imageFile || isSegmenting}>{isSegmenting ? <><Loader2 size={16} className="spin-icon" /> Segmenting…</> : <><Layers3 size={16} /> Generate segmentation mask</>}</button>
                {segmentationError && <div className="error-message" style={{ marginTop: 15 }}>{segmentationError}</div>}
                {segmentedUrl && <div style={{ marginTop: 25 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}><h3>Segmentation mask</h3><button className="primary-button" onClick={downloadSegmentation}><Download size={15} /> Download mask</button></div><div className="result-image" style={{ marginTop: 12 }}><img src={segmentedUrl} alt="HSV segmentation mask" /></div><p style={{ fontSize: 12, color: '#71809b', marginTop: 10 }}>White pixels represent regions within the selected HSV range. Black pixels represent excluded regions.</p></div>}
              </section>
            </div>
          )}

          {/* OBJECT DETECTION */}
          {activeWorkspace === 'Object Detection' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="overview-grid">
                <div className="overview-card"><div className="overview-icon blue"><Box size={19} /></div><div><span className="overview-label">DETECTED OBJECTS</span><strong>{detectionResult?.detections.length ?? '—'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon violet"><Layers3 size={19} /></div><div><span className="overview-label">OBJECT CLASSES</span><strong>{detectionResult ? Object.keys(detectionResult.object_counts || {}).length : '—'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon teal"><Gauge size={19} /></div><div><span className="overview-label">INFERENCE TIME</span><strong>{detectionResult ? `${Number(detectionResult.inference_time_ms || 0).toFixed(1)} ms` : '—'}</strong></div></div>
              </section>
              <section className="panel" style={panelCard}>
                <div className="panel-heading"><div><h2>Detection input</h2><p>Upload an image for YOLO11n object detection.</p></div>{imageFile && <button className="text-button" onClick={clearImage}><X size={15} /> Remove</button>}</div>
                {!imageFile ? (
                  <div className={`upload-zone ${isDragging ? 'dragging' : ''}`} style={{ padding: 30, marginTop: 18 }} onDragOver={event => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                    <CloudUpload size={34} color="#5369dc" /><h3>Upload an image</h3><p>Choose an image containing objects to detect.</p>
                    <button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={16} /> Browse images</button><input ref={inputRef} type="file" accept="image/*" hidden onChange={handleInputChange} />{error && <div className="error-message">{error}</div>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, alignItems: 'center', marginTop: 18 }}>
                    <div className="image-preview">{imageUrl && <img src={imageUrl} alt="Detection input" />}</div>
                    <div><strong style={{ overflowWrap: 'anywhere' }}>{imageFile.name}</strong><p style={{ color: '#71809b', fontSize: 13 }}>{imageDimensions}</p><p style={{ color: '#71809b', fontSize: 13 }}>{(imageFile.size / 1048576).toFixed(2)} MB</p><button className="text-button" onClick={() => inputRef.current?.click()}><FolderOpen size={15} /> Change image</button><input ref={inputRef} type="file" accept="image/*" hidden onChange={handleInputChange} /></div>
                  </div>
                )}
              </section>
              <section className="panel" style={panelCard}>
                {sectionTitle('Detection configuration', 'Configure model confidence and non-maximum suppression.', <Settings2 size={20} color="#5369dc" />)}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 25, marginTop: 22 }}>
                  <label style={{ fontSize: 13 }}>Confidence threshold<strong style={{ display: 'block', marginTop: 7 }}>{confidence.toFixed(2)}</strong><input type="range" min="0.05" max="0.95" step="0.05" value={confidence} onChange={event => { setConfidence(Number(event.target.value)); resetDetectionResults() }} style={rangeStyle} /><span style={{ color: '#71809b', fontSize: 11 }}>Higher values filter out less-confident predictions.</span></label>
                  <label style={{ fontSize: 13 }}>IoU threshold<strong style={{ display: 'block', marginTop: 7 }}>{iouThreshold.toFixed(2)}</strong><input type="range" min="0.10" max="0.90" step="0.05" value={iouThreshold} onChange={event => { setIouThreshold(Number(event.target.value)); resetDetectionResults() }} style={rangeStyle} /><span style={{ color: '#71809b', fontSize: 11 }}>Controls suppression of overlapping detections.</span></label>
                </div>
                <div style={{ marginTop: 22, padding: 15, background: '#f6f8fd', borderRadius: 10, fontSize: 12, color: '#71809b', lineHeight: 1.7 }}><strong style={{ color: '#172746' }}>Model: YOLO11n · ONNX Runtime</strong><br />Inference runs through the configured local backend.</div>
                <button className="primary-button" style={{ marginTop: 22 }} onClick={analyzeObjects} disabled={!imageFile || isDetecting}>{isDetecting ? <><Loader2 size={16} className="spin-icon" /> Detecting objects…</> : <><Box size={16} /> Run object detection</>}</button>
                {detectionError && <div className="error-message" style={{ marginTop: 15 }}>{detectionError}</div>}
                {!imageFile && <p style={{ color: '#71809b', fontSize: 12, marginTop: 12 }}>Upload an image to enable object detection.</p>}
              </section>
              {detectionResult && (
                <>
                  <section className="panel" style={panelCard}>
                    <div className="panel-heading"><div><h2>Annotated detection result</h2><p>Objects identified and localized by YOLO11n.</p></div><button className="primary-button" onClick={downloadDetectionImage}><Download size={16} /> Download result</button></div>
                    <div className="result-image" style={{ marginTop: 18 }}><img src={detectionResult.annotated_image} alt="YOLO object detection output" /></div>
                    <div className="result-footer" style={{ marginTop: 12 }}><span><CheckCircle2 size={15} /> Detection completed successfully</span><span>{Number(detectionResult.inference_time_ms || 0).toFixed(2)} ms</span></div>
                  </section>
                  <section className="panel" style={panelCard}>
                    {sectionTitle('Object distribution', 'Number of detected instances for each class.')}
                    {Object.entries(detectionResult.object_counts || {}).length === 0 ? <p style={{ color: '#71809b', marginTop: 18 }}>No objects were detected at the selected confidence threshold.</p> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 18 }}>{Object.entries(detectionResult.object_counts).map(([name, count]) => <div key={name} style={{ padding: 16, background: '#f6f8fd', border: '1px solid #e6eaf2', borderRadius: 10 }}><span style={{ color: '#71809b', fontSize: 12, textTransform: 'capitalize' }}>{name}</span><div style={{ fontSize: 25, fontWeight: 750, marginTop: 6 }}>{count}</div></div>)}</div>}
                  </section>
                  <section className="panel" style={panelCard}>
                    <div className="panel-heading"><div><h2>Individual detections</h2><p>Class labels and model confidence scores.</p></div><span className="small-badge">{detectionResult.detections.length} DETECTIONS</span></div>
                    {detectionResult.detections.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: '#71809b' }}><Box size={28} /><h3>No objects detected</h3><p>Try lowering the confidence threshold and run detection again.</p></div> : (
                      <div style={{ overflowX: 'auto', marginTop: 18 }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}><thead><tr style={{ background: '#f6f8fd', color: '#71809b' }}><th style={{ padding: 12 }}>#</th><th style={{ padding: 12 }}>Object class</th><th style={{ padding: 12 }}>Confidence</th></tr></thead><tbody>{detectionResult.detections.map((detection, index) => { const label = detection.class_name ?? detection.class ?? detection.label ?? 'Unknown object'; const rawScore = Number(detection.confidence ?? detection.score ?? 0); const score = rawScore <= 1 ? rawScore * 100 : rawScore; return <tr key={index} style={{ borderBottom: '1px solid #edf0f5' }}><td style={{ padding: 12 }}>{index + 1}</td><td style={{ padding: 12, fontWeight: 650, textTransform: 'capitalize' }}>{String(label)}</td><td style={{ padding: 12 }}>{score.toFixed(2)}%</td></tr> })}</tbody></table></div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {/* SHAPE ANALYSIS */}
          {activeWorkspace === 'Shape Analysis' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="overview-grid">
                <div className="overview-card"><div className="overview-icon blue"><Activity size={19} /></div><div><span className="overview-label">DETECTED OBJECTS</span><strong>{shapeResult?.detected_objects ?? '—'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon violet"><Layers3 size={19} /></div><div><span className="overview-label">TOTAL CONTOURS</span><strong>{shapeResult?.total_contours ?? '—'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon teal"><Gauge size={19} /></div><div><span className="overview-label">IMAGE DIMENSIONS</span><strong>{shapeResult ? `${shapeResult.image_dimensions.width} × ${shapeResult.image_dimensions.height}` : imageDimensions || '—'}</strong></div></div>
              </section>
              <section className="panel" style={panelCard}>
                <div className="panel-heading"><div><h2>Shape analysis input</h2><p>Upload an image containing objects or geometric shapes.</p></div>{imageFile && <button className="text-button" onClick={clearImage}><X size={15} /> Remove</button>}</div>
                {!imageFile ? (
                  <div className={`upload-zone ${isDragging ? 'dragging' : ''}`} style={{ padding: 30, marginTop: 18 }} onDragOver={event => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                    <CloudUpload size={34} color="#5369dc" /><h3>Upload an image for shape analysis</h3><p>Choose a clear image with visible objects and boundaries.</p><button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={16} /> Browse images</button><input ref={inputRef} type="file" accept="image/*" hidden onChange={handleInputChange} />{error && <div className="error-message">{error}</div>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, alignItems: 'center', marginTop: 18 }}><div className="image-preview">{imageUrl && <img src={imageUrl} alt="Shape analysis input" />}</div><div><strong style={{ overflowWrap: 'anywhere' }}>{imageFile.name}</strong><p style={{ color: '#71809b', fontSize: 13 }}>{imageDimensions}</p><p style={{ color: '#71809b', fontSize: 13 }}>{(imageFile.size / 1048576).toFixed(2)} MB</p><button className="text-button" onClick={() => inputRef.current?.click()}><FolderOpen size={15} /> Change image</button><input ref={inputRef} type="file" accept="image/*" hidden onChange={handleInputChange} /></div></div>
                )}
              </section>
              <section className="panel" style={panelCard}>
                {sectionTitle('Detection parameters', 'Configure thresholding and contour filtering.', <Settings2 size={20} color="#5369dc" />)}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 18, marginTop: 20 }}>
                  <label style={{ fontSize: 13 }}>Threshold method<select value={thresholdMode} onChange={event => { setThresholdMode(event.target.value); resetShapeResults() }} style={{ ...fieldStyle, width: '100%' }}><option value="otsu">Otsu automatic</option><option value="binary">Binary threshold</option><option value="inverse">Inverse binary</option><option value="adaptive">Adaptive threshold</option></select></label>
                  <label style={{ fontSize: 13 }}>Minimum contour area<strong style={{ display: 'block', marginTop: 7 }}>{minArea.toLocaleString()} px²</strong><input type="range" min="0" max="10000" step="50" value={minArea} onChange={event => { setMinArea(Number(event.target.value)); resetShapeResults() }} style={rangeStyle} /></label>
                  <label style={{ fontSize: 13 }}>Approximation sensitivity<strong style={{ display: 'block', marginTop: 7 }}>{epsilonFactor.toFixed(3)}</strong><input type="range" min="0.001" max="0.1" step="0.001" value={epsilonFactor} onChange={event => { setEpsilonFactor(Number(event.target.value)); resetShapeResults() }} style={rangeStyle} /></label>
                </div>
                {thresholdMode === 'binary' && <label style={{ display: 'block', fontSize: 13, marginTop: 20 }}>Threshold value: <strong>{shapeThreshold}</strong><input type="range" min="0" max="255" value={shapeThreshold} onChange={event => { setShapeThreshold(Number(event.target.value)); resetShapeResults() }} style={rangeStyle} /></label>}
                <button className="primary-button" style={{ marginTop: 22 }} onClick={analyzeShapes} disabled={!imageFile || isAnalyzingShapes}>{isAnalyzingShapes ? <><Loader2 size={16} className="spin-icon" /> Analyzing shapes…</> : <><Activity size={16} /> Run shape analysis</>}</button>
                {shapeError && <div className="error-message" style={{ marginTop: 15 }}>{shapeError}</div>}
                {!imageFile && <p style={{ color: '#71809b', fontSize: 12, marginTop: 12 }}>Upload an image to enable shape analysis.</p>}
              </section>
              {shapeResult && (
                <>
                  <section className="panel" style={panelCard}>
                    <div className="panel-heading"><div><h2>Annotated detection result</h2><p>Detected contours, bounding boxes and object labels.</p></div><button className="primary-button" onClick={downloadShapeImage}><Download size={16} /> Download result</button></div>
                    <div className="result-image" style={{ marginTop: 18 }}><img src={shapeResult.annotated_image} alt="Shape analysis annotated output" /></div>
                    <div className="result-footer" style={{ marginTop: 12 }}><span><CheckCircle2 size={15} /> Analysis completed successfully</span><span>{shapeResult.threshold_mode.toUpperCase()} threshold</span></div>
                  </section>
                  <section className="panel" style={panelCard}>
                    <div className="panel-heading"><div><h2>Detected shape measurements</h2><p>Select an object to inspect its geometric properties.</p></div><span className="small-badge">{shapeResult.shapes.length} OBJECTS</span></div>
                    {shapeResult.shapes.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: '#71809b' }}><Activity size={28} /><h3>No shapes detected</h3><p>Try a different threshold method or lower the minimum contour area.</p></div> : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 18 }}>
                        {shapeResult.shapes.map(shape => <button key={shape.id} onClick={() => setSelectedShape(selectedShape === shape.id ? null : shape.id)} style={{ textAlign: 'left', padding: 16, borderRadius: 11, border: selectedShape === shape.id ? '2px solid #5369dc' : '1px solid #e3e8f1', background: selectedShape === shape.id ? '#f3f5ff' : '#fff', cursor: 'pointer', color: '#172746' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>{shape.shape}</strong><span style={{ color: '#5369dc', fontSize: 12, fontWeight: 700 }}>#{shape.id}</span></div><div style={{ color: '#71809b', fontSize: 12, marginTop: 10 }}><div>Area: {shape.area.toLocaleString()} px²</div><div>Perimeter: {shape.perimeter.toLocaleString()} px</div><div>Vertices: {shape.vertices}</div></div><div style={{ color: '#5369dc', fontSize: 11, marginTop: 10 }}>{selectedShape === shape.id ? 'Hide details' : 'View geometry details →'}</div></button>)}
                      </div>
                    )}
                    {shapeResult.shapes.map(shape => selectedShape === shape.id && <div key={`details-${shape.id}`} style={{ marginTop: 20, padding: 20, borderRadius: 12, background: '#f6f8fd', border: '1px solid #e6eaf2' }}><h3 style={{ marginTop: 0 }}>Object #{shape.id} — {shape.shape}</h3><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>{[['Area', `${shape.area.toLocaleString()} px²`], ['Perimeter', `${shape.perimeter.toLocaleString()} px`], ['Vertices', String(shape.vertices)], ['Aspect ratio', shape.aspect_ratio.toFixed(3)], ['Circularity', shape.circularity.toFixed(3)], ['Solidity', shape.solidity.toFixed(3)], ['Centroid X', `${shape.centroid.x} px`], ['Centroid Y', `${shape.centroid.y} px`]].map(([label, value]) => <div key={label} style={{ padding: 12, background: '#fff', borderRadius: 8 }}><span style={{ color: '#71809b', fontSize: 11 }}>{label}</span><strong style={{ display: 'block', marginTop: 5, fontSize: 15 }}>{value}</strong></div>)}</div><h4 style={{ marginBottom: 8 }}>Bounding box</h4><p style={{ color: '#71809b', fontSize: 13, margin: 0 }}>X: {shape.bounding_box.x} · Y: {shape.bounding_box.y} · Width: {shape.bounding_box.width} · Height: {shape.bounding_box.height}</p></div>)}
                  </section>
                </>
              )}
            </div>
          )}

          {/* VIDEO INTELLIGENCE */}
          {activeWorkspace === 'Video Intelligence' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="overview-grid">
                <div className="overview-card"><div className="overview-icon blue"><Film size={19} /></div><div><span className="overview-label">VIDEO INPUT</span><strong>{videoFile ? '1 video loaded' : 'No video loaded'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon violet"><Layers3 size={19} /></div><div><span className="overview-label">SAMPLED FRAMES</span><strong>{videoResult?.sampled_frames_count ?? '—'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon teal"><Gauge size={19} /></div><div><span className="overview-label">TOTAL DETECTIONS</span><strong>{videoResult?.total_detections ?? '—'}</strong></div></div>
              </section>

              <section className="panel" style={panelCard}>
                <div className="panel-heading">
                  <div><h2>Video input</h2><p>Upload a video for sampled-frame object detection using YOLO11n.</p></div>
                  {videoFile && <button className="text-button" onClick={() => { setVideoFile(null); setVideoResult(null); setVideoError('') }}><X size={15} /> Remove</button>}
                </div>

                {!videoFile ? (
                  <div className="upload-zone" style={{ padding: 35, marginTop: 18 }}>
                    <Film size={36} color="#5369dc" />
                    <h3>Upload a video</h3>
                    <p>Select a supported video file from your computer.</p>
                    <button className="primary-button" onClick={() => videoInputRef.current?.click()}><Upload size={16} /> Browse videos</button>
                    <input ref={videoInputRef} type="file" accept=".mp4,.avi,.mov,.mkv,.webm,.m4v,video/*" hidden onChange={handleVideoInputChange} />
                    <div className="upload-formats"><span>MP4</span><span>AVI</span><span>MOV</span><span>MKV</span><span>WEBM</span><i /> Maximum 100 MB</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, alignItems: 'center', marginTop: 18 }}>
                    <div style={{ background: '#101828', borderRadius: 12, overflow: 'hidden' }}>
                      {videoUrl && <video src={videoUrl} controls style={{ width: '100%', display: 'block', maxHeight: 350 }} />}
                    </div>
                    <div>
                      <strong style={{ overflowWrap: 'anywhere' }}>{videoFile.name}</strong>
                      <p style={{ color: '#71809b', fontSize: 13 }}>{(videoFile.size / 1048576).toFixed(2)} MB</p>
                      <p style={{ color: '#71809b', fontSize: 12 }}>Video loaded and ready for analysis.</p>
                      <button className="text-button" onClick={() => videoInputRef.current?.click()}><FolderOpen size={15} /> Choose another video</button>
                      <input ref={videoInputRef} type="file" accept=".mp4,.avi,.mov,.mkv,.webm,.m4v,video/*" hidden onChange={handleVideoInputChange} />
                    </div>
                  </div>
                )}
                {videoError && <div className="error-message" style={{ marginTop: 15 }}>{videoError}</div>}
              </section>

              <section className="panel" style={panelCard}>
                {sectionTitle('Video analysis settings', 'Choose how frequently frames are sampled and configure YOLO11n detection.', <Settings2 size={20} color="#5369dc" />)}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 22, marginTop: 22 }}>
                  <label style={{ fontSize: 13 }}>Sampling interval<strong style={{ display: 'block', marginTop: 7 }}>{sampleInterval.toFixed(1)} seconds</strong><input type="range" min="0.2" max="10" step="0.2" value={sampleInterval} onChange={event => setSampleInterval(Number(event.target.value))} style={rangeStyle} /><span style={{ color: '#71809b', fontSize: 11 }}>Time between sampled frames.</span></label>
                  <label style={{ fontSize: 13 }}>Maximum frames<strong style={{ display: 'block', marginTop: 7 }}>{maxFrames} frames</strong><input type="range" min="1" max="30" step="1" value={maxFrames} onChange={event => setMaxFrames(Number(event.target.value))} style={rangeStyle} /><span style={{ color: '#71809b', fontSize: 11 }}>Limits the number of frames analyzed.</span></label>
                  <label style={{ fontSize: 13 }}>Confidence threshold<strong style={{ display: 'block', marginTop: 7 }}>{confidence.toFixed(2)}</strong><input type="range" min="0.05" max="0.95" step="0.05" value={confidence} onChange={event => setConfidence(Number(event.target.value))} style={rangeStyle} /></label>
                  <label style={{ fontSize: 13 }}>IoU threshold<strong style={{ display: 'block', marginTop: 7 }}>{iouThreshold.toFixed(2)}</strong><input type="range" min="0.10" max="0.90" step="0.05" value={iouThreshold} onChange={event => setIouThreshold(Number(event.target.value))} style={rangeStyle} /></label>
                </div>
                <div style={{ marginTop: 20, padding: 15, background: '#f6f8fd', borderRadius: 10, color: '#71809b', fontSize: 12, lineHeight: 1.7 }}>
                  <strong style={{ color: '#172746' }}>Model: YOLO11n · ONNX Runtime</strong><br />
                  Frames are sampled at the selected interval. Increasing the maximum frame count or analyzing longer videos may increase processing time.
                </div>
                <button className="primary-button" style={{ marginTop: 22 }} onClick={analyzeVideo} disabled={!videoFile || isAnalyzingVideo}>
                  {isAnalyzingVideo ? <><Loader2 size={16} className="spin-icon" /> Analyzing video…</> : <><Film size={16} /> Analyze video</>}
                </button>
                {isAnalyzingVideo && <p style={{ color: '#71809b', fontSize: 12, marginTop: 12 }}>The backend is sampling frames and running object detection. Please keep this page open.</p>}
              </section>

              {videoResult && (
                <>
                  <section className="panel" style={panelCard}>
                    <div className="panel-heading"><div><h2>Video analysis report</h2><p>Video metadata and processing performance.</p></div><span className="small-badge">ANALYSIS COMPLETE</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12, marginTop: 20 }}>
                      {[
                        ['Duration', `${Number(videoResult.video_metadata.duration_seconds).toFixed(2)} sec`],
                        ['Frame rate', `${Number(videoResult.video_metadata.fps).toFixed(2)} FPS`],
                        ['Resolution', videoResult.video_metadata.resolution || `${videoResult.video_metadata.width} × ${videoResult.video_metadata.height}`],
                        ['Total frames', videoResult.video_metadata.total_frames.toLocaleString()],
                        ['Sampled frames', videoResult.sampled_frames_count],
                        ['Total detections', videoResult.total_detections],
                        ['Inference time', `${Number(videoResult.detection_inference_time_ms).toFixed(1)} ms`],
                        ['Total time', `${Number(videoResult.total_processing_time_ms).toFixed(2)} ms`],
                      ].map(([label, value]) => <div key={String(label)} style={{ padding: 15, background: '#f6f8fd', border: '1px solid #e6eaf2', borderRadius: 10 }}><span style={{ color: '#71809b', fontSize: 11 }}>{label}</span><strong style={{ display: 'block', fontSize: 18, marginTop: 7 }}>{value}</strong></div>)}
                    </div>
                    <p style={{ color: '#71809b', fontSize: 12, lineHeight: 1.6, marginTop: 18 }}>{videoResult.count_note || 'Object counts represent detections across sampled frames, not unique tracked objects.'}</p>
                  </section>

                  <section className="panel" style={panelCard}>
                    {sectionTitle(
                      'Detection breakdown by frame',
                      'See how many objects the model detected in each analyzed frame.'
                    )}

                    {videoObjectClasses.length === 0 ? (
                      <p style={{ color: '#71809b', marginTop: 18 }}>
                        No objects were detected in the sampled frames.
                      </p>
                    ) : (
                      <>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 12,
                          marginTop: 20,
                        }}>
                          {videoObjectClasses.map(name => {
                            const total = videoResult.aggregate_object_counts?.[name] ??
                              videoResult.sampled_frames.reduce(
                                (sum, frame) => sum + (frame.object_counts?.[name] ?? 0),
                                0
                              )
                            const framesPresent = videoResult.sampled_frames.filter(
                              frame => (frame.object_counts?.[name] ?? 0) > 0
                            ).length

                            return (
                              <div key={name} style={{
                                padding: 17,
                                background: '#f6f8fd',
                                border: '1px solid #e6eaf2',
                                borderRadius: 10,
                              }}>
                                <span style={{ color: '#71809b', fontSize: 12, textTransform: 'capitalize' }}>
                                  {name}
                                </span>
                                <div style={{ fontSize: 26, fontWeight: 750, marginTop: 6 }}>
                                  {total}
                                </div>
                                <p style={{ color: '#71809b', fontSize: 11, margin: '5px 0 0' }}>
                                  Detections across {framesPresent} analyzed frames
                                </p>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ marginTop: 28 }}>
                          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Frame-by-frame details</h3>
                          <p style={{ color: '#71809b', fontSize: 12, marginBottom: 15 }}>
                            Each row is one sampled frame. The numbers show detections in that frame.
                          </p>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                              <thead>
                                <tr style={{ background: '#f6f8fd', color: '#71809b' }}>
                                  <th style={{ padding: 13 }}>Frame</th>
                                  <th style={{ padding: 13 }}>Time</th>
                                  {videoObjectClasses.map(name => (
                                    <th key={name} style={{ padding: 13, textTransform: 'capitalize' }}>{name}</th>
                                  ))}
                                  <th style={{ padding: 13 }}>Total detections</th>
                                </tr>
                              </thead>
                              <tbody>
                                {videoResult.sampled_frames.map((frame, index) => (
                                  <tr key={`${frame.frame_index}-${index}`} style={{ borderBottom: '1px solid #edf0f5' }}>
                                    <td style={{ padding: 13, fontWeight: 650 }}>{frame.frame_index}</td>
                                    <td style={{ padding: 13, color: '#71809b' }}>{formatTime(frame.timestamp_seconds)}</td>
                                    {videoObjectClasses.map(name => (
                                      <td key={name} style={{ padding: 13, fontWeight: 650 }}>
                                        {frame.object_counts?.[name] ?? 0}
                                      </td>
                                    ))}
                                    <td style={{ padding: 13, fontWeight: 750, color: '#5369dc' }}>
                                      {frame.detections_count}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <p style={{ marginTop: 16, padding: 13, background: '#f6f8fd', borderRadius: 9, color: '#71809b', fontSize: 12, lineHeight: 1.7 }}>
                          Important: The same person or object may appear in several frames and be counted again. This version performs object detection on individual frames; it does not track unique people across the video.
                        </p>
                      </>
                    )}
                  </section>

                  <section className="panel" style={panelCard}>
                    <div className="panel-heading"><div><h2>Sampled frame results</h2><p>Annotated frames with detection labels and confidence scores.</p></div><span className="small-badge">{videoResult.sampled_frames.length} FRAMES</span></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginTop: 20 }}>
                      {videoResult.sampled_frames.map((frame, index) => (
                        <div key={`${frame.frame_index}-${index}`} style={{ border: '1px solid #e5e9f1', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                          <div style={{ background: '#101828' }}><img src={frame.annotated_image} alt={`Annotated video frame ${frame.frame_index}`} style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'contain' }} /></div>
                          <div style={{ padding: 15 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><strong>Frame {frame.frame_index}</strong><span style={{ color: '#71809b', fontSize: 12 }}>{formatTime(frame.timestamp_seconds)}</span></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, color: '#71809b', fontSize: 12 }}><span>{frame.detections_count} detections</span><span>{Number(frame.inference_time_ms).toFixed(1)} ms</span></div>
                            {Object.entries(frame.object_counts || {}).length > 0 && <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{Object.entries(frame.object_counts).map(([name, count]) => <span key={name} style={{ background: '#eef1ff', color: '#465bd1', padding: '4px 8px', borderRadius: 6, fontSize: 11 }}>{name}: {count}</span>)}</div>}
                            <button className="text-button" style={{ marginTop: 12 }} onClick={() => downloadVideoFrame(frame)}><Download size={14} /> Download annotated frame</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {/* EXPERIMENT LAB */}
          {activeWorkspace === 'Experiments' && (
            <div style={{ display: 'grid', gap: 20 }}>
              <section className="overview-grid">
                <div className="overview-card"><div className="overview-icon blue"><ImageIcon size={19} /></div><div><span className="overview-label">INPUT IMAGE</span><strong>{imageFile ? imageFile.name : 'Not selected'}</strong></div></div>
                <div className="overview-card"><div className="overview-icon violet"><Layers3 size={19} /></div><div><span className="overview-label">SELECTED ALGORITHMS</span><strong>{experimentOperations.length}</strong></div></div>
                <div className="overview-card"><div className="overview-icon teal"><Gauge size={19} /></div><div><span className="overview-label">COMPLETED RUNS</span><strong>{experimentResults.length}</strong></div></div>
              </section>
              <section className="panel" style={panelCard}>
                <div className="panel-heading"><div><h2>Experiment input</h2><p>Use one image as the common input for every selected algorithm.</p></div>{imageFile && <button className="text-button" onClick={clearImage}><X size={15} /> Remove image</button>}</div>
                {!imageFile ? (
                  <div className={`upload-zone ${isDragging ? 'dragging' : ''}`} style={{ marginTop: 18 }} onDragOver={event => { event.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                    <div className="upload-illustration"><div className="upload-icon-back"><FileImage size={31} /></div><div className="upload-cloud"><CloudUpload size={23} /></div></div>
                    <h3>Upload an image for comparison</h3><p>Every algorithm will process the same input image.</p>
                    <button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={17} /> Browse images</button>
                    <input ref={inputRef} type="file" accept="image/*" onChange={handleInputChange} hidden />
                    <div className="upload-formats"><span>JPG</span><span>PNG</span><span>WEBP</span><span>AVIF</span><i /> Maximum 20 MB</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(180px, .7fr)', gap: 20, alignItems: 'center', marginTop: 18 }}>
                    <div className="image-preview">{imageUrl && <img src={imageUrl} alt="Experiment input" />}</div>
                    <div><strong style={{ overflowWrap: 'anywhere' }}>{imageFile.name}</strong><p style={{ color: '#71809b', fontSize: 13 }}>{imageDimensions} · {(imageFile.size / 1048576).toFixed(2)} MB</p><button className="text-button" onClick={() => inputRef.current?.click()}><FolderOpen size={15} /> Change image</button><input ref={inputRef} type="file" accept="image/*" hidden onChange={handleInputChange} /></div>
                  </div>
                )}
                {error && <div className="error-message">{error}</div>}
              </section>
              <section className="panel" style={panelCard}>
                <div className="panel-heading"><div><h2>Choose algorithms</h2><p>Select at least two algorithms to compare their output and processing time.</p></div><span className="small-badge">12 AVAILABLE</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, marginTop: 18 }}>
                  {operations.map(operation => (
                    <label key={operation.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 13, border: `1px solid ${experimentOperations.includes(operation.id) ? '#8795ed' : '#e5e9f1'}`, borderRadius: 10, background: experimentOperations.includes(operation.id) ? '#f5f6ff' : '#fff', cursor: isRunningExperiments ? 'not-allowed' : 'pointer', opacity: isRunningExperiments ? .65 : 1 }}>
                      <input type="checkbox" checked={experimentOperations.includes(operation.id)} disabled={isRunningExperiments} onChange={() => toggleExperimentOperation(operation.id)} style={{ marginTop: 3, accentColor: '#5369dc' }} />
                      <span><strong style={{ display: 'block', fontSize: 13, color: '#172746' }}>{operation.name}</strong><span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#71809b', lineHeight: 1.5 }}>{operation.description}</span></span>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 20 }}>
                  <button className="primary-button" onClick={runExperiments} disabled={!imageFile || experimentOperations.length < 2 || isRunningExperiments}>{isRunningExperiments ? <><Loader2 size={16} className="spin-icon" /> Running experiments…</> : <><Activity size={16} /> Run comparison</>}</button>
                  <span style={{ color: '#71809b', fontSize: 12 }}>{isRunningExperiments ? experimentProgress : 'Runs sequentially to keep local CPU usage manageable.'}</span>
                </div>
                {experimentError && <div className="error-message" style={{ marginTop: 15 }}>{experimentError}</div>}
                {!imageFile && <p style={{ color: '#71809b', fontSize: 12, marginTop: 12 }}>Upload an image to enable experiments.</p>}
              </section>
              {experimentResults.length > 0 && (
                <section className="panel" style={panelCard}>
                  <div className="panel-heading"><div><h2>Experiment results</h2><p>Each output was generated from the same uploaded image. Processing time includes the API request and image response.</p></div><span className="small-badge">{experimentResults.length} RESULTS</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginTop: 20 }}>
                    {experimentResults.map(result => (
                      <article key={result.operation} style={{ border: '1px solid #e5e9f1', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                        <div style={{ background: '#101828', minHeight: 170, display: 'grid', placeItems: 'center' }}><img src={result.imageUrl} alt={`${result.name} experiment output`} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} /></div>
                        <div style={{ padding: 15 }}><strong>{result.name}</strong><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}><div><span className="overview-label">PROCESSING TIME</span><strong style={{ display: 'block', marginTop: 4 }}>{result.timeMs.toFixed(1)} ms</strong></div><div><span className="overview-label">OUTPUT SIZE</span><strong style={{ display: 'block', marginTop: 4 }}>{result.width} × {result.height}</strong></div></div><button className="text-button" style={{ marginTop: 14 }} onClick={() => downloadExperimentResult(result)}><Download size={14} /> Download output</button></div>
                      </article>
                    ))}
                  </div>
                  {experimentResults.length === experimentOperations.length && <div style={{ marginTop: 18, padding: 14, background: '#f6f8fd', borderRadius: 10, color: '#71809b', fontSize: 12, lineHeight: 1.6 }}>Comparison complete. Timings are measured on this machine and include network/local API overhead; they are not benchmark scores across different computers.</div>}
                </section>
              )}
            </div>
          )}

          <footer className="page-footer">
            <span>VisionLab<span className="footer-dot"> · </span>Computer Vision & Visual Intelligence Platform</span>
            <span>Development release<span className="footer-dot"> · </span>v0.1</span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App