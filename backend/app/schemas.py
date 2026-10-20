"""Pydantic model yang dikirim ke frontend untuk semua kebutuhan render overlay."""
from typing import List, Optional

from pydantic import BaseModel, Field


class Tooth(BaseModel):
    """Satu gigi tersegmentasi; semua geometri dinormalisasi 0-1."""
    index: int
    polygon: List[List[float]] = Field(..., description="ring verteks [x, y] normalisasi")
    centroid: List[float]
    box: List[float] = Field(..., description="[x1, y1, x2, y2] normalisasi")
    angle: float = Field(..., description="sudut poros utama gigi dalam derajat")


class Bracket(BaseModel):
    """Bracket pada satu gigi; posisi di-center bracket, orientasi mengikuti arka."""
    tooth: int
    center: List[float]
    angle: float
    width: float = Field(..., description="lebar bracket normalisasi terhadap lebar gambar")
    height: float = Field(..., description="tinggi bracket normalisasi terhadap tinggi gambar")


class Overlay(BaseModel):
    """Semua yang dibutuhkan frontend untuk menggambar mask + behel via SVG/canvas."""
    teeth: List[Tooth]
    brackets: List[Bracket]
    archwire: Optional[str] = None


class Problem(BaseModel):
    key: str
    label: str
    severity: str = Field(..., pattern="^(ringan|sedang|berat)$")
    confidence: float = Field(..., ge=0, le=1)
    affected: List[int] = Field(default_factory=list)


class ProcessedInfo(BaseModel):
    width: int
    height: int
    exif_rotated: bool
    mode: str = Field(..., pattern="^(mock|model)$")


class AnalyzeResponse(BaseModel):
    processed: ProcessedInfo
    overlay: Overlay
    problems: List[Problem]
    overall_severity: str
    recommendations: List[str]
    insufficient: bool = Field(False, description="True bila arka gigi tidak cukup lengkap untuk aturan")
    mock: bool = Field(False, description="True bila pakai segmentasi mock")

