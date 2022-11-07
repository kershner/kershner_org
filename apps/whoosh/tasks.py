from django.core.files.base import File
from apps.whoosh import whoosh_ffmpeg
from django.utils import timezone
from portfolio.celery import app
from utility import util
import tempfile
import logging
import os


logger = logging.getLogger('portfolio.tasks')


@app.task(name='process-whoosh')
def process_whoosh(whoosh_id):
    from apps.whoosh.models import Whoosh
    logger.info('\n============ Running create_whoosh as Celery task....')
    whoosh = Whoosh.objects.filter(id=whoosh_id).first()

    s3 = util.get_s3_client()
    params = util.get_parameters()
    with tempfile.NamedTemporaryFile(delete=False) as f:
        s3.download_fileobj(params['s3_bucket'], whoosh.uploaded_video_s3_key, f)
        output_filename = '{}.mp4'.format(f.name)
        thumbnail_filename = '{}.jpeg'.format(f.name)

        # Get video details with FFProbe
        ffprobe_result = whoosh_ffmpeg.ffprobe(f.name)
        whoosh.video_data = ffprobe_result['json']
        whoosh.processed = None
        whoosh.settings_hash = util.hash_data_structure(whoosh.doppelganger_settings())
        whoosh.save()

        error = []

        try:
            # Process video with FFMPEG
            create_video_output = whoosh_ffmpeg.run_whoosh_ffmpeg(whoosh, f.name, output_filename, thumbnail_filename)
            logger.info('create_video_output: {}'.format(create_video_output))
            # whoosh.processed_video.save(output_filename, File(open(output_filename, 'rb')))
        except Exception as e:
            error.append(e)

        # try:
        #     # Generate thumbnail
        #     # TODO - something about this is failing on the EC2
        #     create_thumbnail_output = whoosh_ffmpeg.run_whoosh_thumbnail_ffmpeg(output_filename, thumbnail_filename)
        #     logger.info('create_thumbnail_output: {}'.format(create_thumbnail_output))
        #     # Save video and thumbnail to model
        #     # whoosh.thumbnail.save(thumbnail_filename, File(open(thumbnail_filename, 'rb')))
        # except Exception as e:
        #     error.append(e)

        whoosh.processed_video.save(output_filename, File(open(output_filename, 'rb')))
        whoosh.thumbnail.save(thumbnail_filename, File(open(thumbnail_filename, 'rb')))

        # Store the processed files in the /saved directory if not already
        if whoosh.saved and not whoosh.saved_video:
            whoosh.saved_thumbnail.save(thumbnail_filename, File(open(thumbnail_filename, 'rb')))
            whoosh.saved_video.save(output_filename, File(open(output_filename, 'rb')))

        whoosh.processed = timezone.now()

        # Refresh ffprobe data
        ffprobe_result = whoosh_ffmpeg.ffprobe(output_filename)
        whoosh.video_data = ffprobe_result['json']

        whoosh.error = ','.join([str(e) for e in error])

        # Video/thumbnail get uploaded to S3 on save()
        whoosh.save()

        # Cleanup local files
        f.close()

        try:
            os.unlink(f.name)
        except Exception as e:
            logger.info(e)

        try:
            os.unlink(output_filename)
        except Exception as e:
            logger.info(e)

        try:
            os.unlink(thumbnail_filename)
        except Exception as e:
            logger.info(e)

@app.task(name='delete-whoosh-media')
def delete_whoosh_media(uploaded_s3_key, processed_s3_key, thumbnail_key):
    logger.info('\n============ Running delete_whoosh_media as Celery task....')
    util.remove_key_from_s3(uploaded_s3_key)
    util.remove_key_from_s3(processed_s3_key)
    util.remove_key_from_s3(thumbnail_key)
