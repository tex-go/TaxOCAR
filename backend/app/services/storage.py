from minio import Minio
from minio.error import S3Error
import io
from datetime import timedelta
from app.core.config import settings


class StorageService:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            if not self.client.bucket_exists(settings.MINIO_BUCKET):
                self.client.make_bucket(settings.MINIO_BUCKET)
        except S3Error:
            pass

    def upload(self, object_name: str, data: bytes, content_type: str = "application/octet-stream"):
        self.client.put_object(
            settings.MINIO_BUCKET,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    def download(self, object_name: str) -> bytes:
        response = self.client.get_object(settings.MINIO_BUCKET, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        return data

    def get_presigned_url(self, object_name: str, expires_hours: int = 2) -> str:
        return self.client.presigned_get_object(
            settings.MINIO_BUCKET,
            object_name,
            expires=timedelta(hours=expires_hours),
        )

    def delete(self, object_name: str):
        try:
            self.client.remove_object(settings.MINIO_BUCKET, object_name)
        except S3Error:
            pass
