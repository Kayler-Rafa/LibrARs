from pydantic import BaseModel, field_validator, model_validator

VECTOR_DIM = 63


class GestureCreate(BaseModel):
    id: str | None = None
    name: str
    samples: list[list[float]]

    @field_validator("samples")
    @classmethod
    def validate_samples(cls, v: list[list[float]]) -> list[list[float]]:
        if not v:
            raise ValueError("samples não pode ser vazio")
        for i, s in enumerate(v):
            if len(s) != VECTOR_DIM:
                raise ValueError(
                    f"sample[{i}] deve ter {VECTOR_DIM} dimensões, recebeu {len(s)}"
                )
        return v


class GestureOut(BaseModel):
    id: str
    name: str
    samples: list[list[float]]
    sample_count: int
    created_at: str
    updated_at: str


class ClassifyRequest(BaseModel):
    vector: list[float]
    gestures: list[dict]

    @field_validator("vector")
    @classmethod
    def validate_vector(cls, v: list[float]) -> list[float]:
        if len(v) != VECTOR_DIM:
            raise ValueError(f"vector deve ter {VECTOR_DIM} dimensões, recebeu {len(v)}")
        return v


class CompressRequest(BaseModel):
    samples: list[list[float]]


BODY_DIM = 10
POSE_POINTS = 7


class BodyFrame(BaseModel):
    """Item 2 — referência corporal de um quadro (alinhado ao quadro de mesmo índice em frames)."""
    pose: list[list[float]] | None = None      # 7 pontos (x, y) em pixels: nariz, olhos, boca, ombros
    hand: list[list[float]] | None = None      # 3 pontos (x, y) em pixels: pulso, ponta do indicador, centro da palma
    features: list[float] | None = None        # 10 features de corpo; null sem pose válida
    pose_ok: bool = False                      # nariz e os dois ombros com visibilidade ≥ 0,5
    size: list[float] | None = None            # largura e altura do vídeo em pixels

    @field_validator("features")
    @classmethod
    def validate_features(cls, v: list[float] | None) -> list[float] | None:
        if v is not None and len(v) != BODY_DIM:
            raise ValueError(f"features deve ter {BODY_DIM} valores, recebeu {len(v)}")
        return v

    @field_validator("pose")
    @classmethod
    def validate_pose(cls, v: list[list[float]] | None) -> list[list[float]] | None:
        if v is not None and (len(v) != POSE_POINTS or any(len(p) != 2 for p in v)):
            raise ValueError(f"pose deve ter {POSE_POINTS} pontos (x, y)")
        return v


class RecordingCreate(BaseModel):
    """Item 1 — uma gravação (repetição) de um gesto."""
    frames: list[list[float]]              # quadros brutos: 63 valores da mão por quadro
    body: list[BodyFrame] | None = None    # por quadro: pontos da pose + features (item 2); null se sem pose
    hand_ratio: float = 0.0                # fração de quadros com mão detectada
    pose_ratio: float = 0.0                # fração de quadros com rosto+ombros detectados
    source: str = "manual"                 # 'manual' | 'segmentado'
    app_version: str | None = None

    @model_validator(mode="after")
    def validate_body_alignment(self):
        if self.body is not None and len(self.body) != len(self.frames):
            raise ValueError(
                f"body deve ter um item por quadro ({len(self.frames)}), recebeu {len(self.body)}"
            )
        return self
