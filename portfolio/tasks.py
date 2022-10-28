from django.core.files.base import File
from apps.whoosh import whoosh_ffmpeg
from django.utils import timezone
from portfolio.celery import app
from utility import util
import tempfile
import logging
import os


logger = logging.getLogger('portfolio.tasks')


@app.task(name='create-whoosh')
def create_whoosh(whoosh_id):
    from apps.whoosh.models import Whoosh
    logger.info('\n============ Running create_whoosh as Celery task....')
    whoosh = Whoosh.objects.filter(id=whoosh_id).first()

    s3 = util.get_s3_client()
    params = util.get_parameters()
    with tempfile.NamedTemporaryFile(delete=False) as f:
        s3.download_fileobj(params['s3_bucket'], whoosh.uploaded_video_s3_key, f)
        output_filename = '{}.mp4'.format(f.name)
        thumbnail_filename = '{}.jpeg'.format(f.name)

        try:
            # Get video details with FFProbe
            ffprobe_result = whoosh_ffmpeg.ffprobe(f.name)
            whoosh.video_data = ffprobe_result['json']
            whoosh.processed = None
            whoosh.save()

            # Process video with FFMPEG
            create_video_output = whoosh_ffmpeg.run_whoosh_ffmpeg(whoosh, f.name, output_filename)
            logger.info('create_video_output: {}'.format(create_video_output))

            # Generate thumbnail
            create_thumbnail_output = whoosh_ffmpeg.run_whoosh_thumbnail_ffmpeg(output_filename, thumbnail_filename)
            logger.info('create_thumbnail_output: {}'.format(create_thumbnail_output))

            # Save video and thumbnail to model
            whoosh.thumbnail.save(thumbnail_filename, File(open(thumbnail_filename, 'rb')))
            whoosh.processed_video.save(output_filename, File(open(output_filename, 'rb')))

            whoosh.processed = timezone.now()

            # Refresh ffprobe data
            ffprobe_result = whoosh_ffmpeg.ffprobe(output_filename)
            whoosh.video_data = ffprobe_result['json']

            # Video/thumbnail get uploaded to S3 on save()
            whoosh.save()
        except Exception as e:
            logger.info(e)

        # Cleanup local files
        f.close()
        os.unlink(f.name)
        os.unlink(output_filename)
        os.unlink(thumbnail_filename)

        # Delete original uploaded file from S3
        util.remove_key_from_s3(whoosh.uploaded_video_s3_key)


@app.task(name='delete-whoosh-media')
def delete_whoosh_media(uploaded_s3_key, processed_s3_key, thumbnail_key):
    logger.info('\n============ Running delete_whoosh_media as Celery task....')
    util.remove_key_from_s3(uploaded_s3_key)
    util.remove_key_from_s3(processed_s3_key)
    util.remove_key_from_s3(thumbnail_key)
