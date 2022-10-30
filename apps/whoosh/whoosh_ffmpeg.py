from django.contrib.staticfiles import finders
from django.conf import settings
import subprocess
import logging


logger = logging.getLogger('whoosh.whoosh_ffmpeg')

FONT_SIZE_DIVISOR = 15
PORTRAIT_FONT_SIZE_DIVISOR = 10
LINE_CHARACTER_LIMIT = 20
PORTRAIT_LINE_CHARACTER_LIMIT = 14
PORTRAIT_RATIO = 9/16
FINAL_W_OR_H = 1200


def ffprobe(file_path):
    ffprobe_cmd = ['ffprobe',
                   '-v', 'quiet',
                   '-print_format', 'json',
                   '-show_format',
                   '-show_streams',
                   file_path]

    result = subprocess.run(ffprobe_cmd,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            universal_newlines=True)
    return {
        'return_code': result.returncode,
        'json': result.stdout,
        'error': result.stderr
    }


def run_whoosh_ffmpeg(whoosh, downloaded_filename, output_filename):
    duration = '15'  # seconds
    audio_path = finders.find('audio/{}.mp3'.format(whoosh.get_whoosh_type_display()))
    ffmpeg_cmd = ['ffmpeg',
                  '-y',
                  '-ss', '{}'.format(whoosh.start_time),
                  '-i', '{}'.format(downloaded_filename),
                  '-i', '{}'.format(audio_path),
                  '-filter_complex', get_complex_filter_str(whoosh),
                  '-map', '[filtered_video]',
                  '-map', '[a]',
                  '-ac', '2',
                  '-crf', '17',
                  '-t', '{}'.format(duration),
                  '{}'.format(output_filename)]

    ffmpeg_result = subprocess.run(ffmpeg_cmd,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE,
                                   universal_newlines=True)
    # if settings.DEBUG:
    print(' '.join(ffmpeg_cmd))
    subprocess.run("clip", universal_newlines=True, input=' '.join(ffmpeg_cmd))
    print("==============================")
    print(ffmpeg_result)

    return ffmpeg_result


def run_whoosh_thumbnail_ffmpeg(video_filename, thumbnail_output_filename):
    starting_seconds = 2
    thumb_width = 320

    # Generate thumbnail
    ffmpeg_thumbnail_command = 'ffmpeg ' \
                               '-ss {} ' \
                               '-i {} ' \
                               '-vframes 1 ' \
                               '-f mjpeg ' \
                               '-vf ' \
                               'scale={}:-2:force_original_aspect_ratio=decrease {}'.format(starting_seconds,
                                                                                            video_filename,
                                                                                            thumb_width,
                                                                                            thumbnail_output_filename)
    ffmpeg_thumbnail_result = subprocess.run(ffmpeg_thumbnail_command,
                                             stdout=subprocess.PIPE,
                                             stderr=subprocess.PIPE,
                                             universal_newlines=True)
    return ffmpeg_thumbnail_result


def get_complex_filter_str(whoosh):
    filter_str = '[0]'

    # Zoom/pan
    if whoosh.slow_zoom:
        zoompan_filter = "zoompan=z='min(max(zoom,pzoom)+0.0015,1.5)':d=0:s={}x{},".format(whoosh.video_width,
                                                                                           whoosh.video_height)
        filter_str = '{}{}'.format(filter_str, zoompan_filter)

    # Cropping
    if whoosh.can_be_cropped and whoosh.portrait:
        crop_and_scale_str = "crop=in_h*{}:in_h,scale=-2:{}".format(PORTRAIT_RATIO, FINAL_W_OR_H)
        filter_str = '{}{}'.format(filter_str, crop_and_scale_str)
    else:
        scale_str = 'scale={}:-2'.format(FINAL_W_OR_H)
        filter_str = '{}{}'.format(filter_str, scale_str)

    # Black and white
    if whoosh.black_and_white:
        bw_filter = 'hue=s=0'
        filter_str = '{},{}'.format(filter_str, bw_filter)

    # Slow mo
    if whoosh.slow_motion:
        slomo_filter = 'setpts=3*PTS'
        filter_str = '{},{}'.format(filter_str, slomo_filter)

    # Audio mixing
    source_mix = 1.0
    if whoosh.mute_source:
        source_mix = 0.0

    filter_str = '[0:a]volume={}[vol];[vol][1:a]amerge[a];{}'.format(source_mix, filter_str)
    formatted_text = get_formatted_credit_text(whoosh)
    drawtext_str = '{}'.format(get_drawtext_filter(whoosh, formatted_text))

    return '{},{}[filtered_video]'.format(filter_str, drawtext_str)


# Split the text into multiple lines if it's too long
def get_formatted_credit_text(whoosh):
    word_list = [' ']
    if whoosh.credit_text:
        word_list = whoosh.credit_text.replace("'", '').upper().split(' ')

    line_limit = PORTRAIT_LINE_CHARACTER_LIMIT if whoosh.portrait else LINE_CHARACTER_LIMIT
    current_line = []
    final_line_list = []
    for index, word in enumerate(word_list):
        current_line_length = len(' '.join(current_line))
        line_len_with_word = current_line_length + len(word)

        if line_len_with_word >= line_limit:
            final_line_list.append(' '.join(current_line))
            current_line = [word]
        else:
            current_line.append(word)

    if len(current_line):
        final_line_list.append(' '.join(current_line))

    return '\r'.join(final_line_list)


def get_drawtext_filter(whoosh, formatted_text):
    # At 2 seconds, fade in over 2 seconds, display text for 5 seconds, then fade out over 2 seconds
    alpha_fadeout_filter = comma_escape('if(lt(t,2),0,if(lt(t,4),(t-2)/2,if(lt(t,9),1,if(lt(t,11),(2-(t-9))/2,0))))')

    new_width = FINAL_W_OR_H
    font_size_divisor = FONT_SIZE_DIVISOR
    if whoosh.portrait:
        new_width = int(FINAL_W_OR_H * PORTRAIT_RATIO)
        font_size_divisor = PORTRAIT_FONT_SIZE_DIVISOR

    drawtext_filter = 'drawtext=' \
                      ':font=Arial' \
                      ':text={formatted_text}' \
                      ':borderw=3:bordercolor=0x33cc33' \
                      ':shadowx=0:shadowy=6' \
                      ':fontcolor=0x663333' \
                      ':fontsize={new_width}/{font_size_divisor}' \
                      ':x=(w-text_w)/2' \
                      ':line_spacing=10' \
                      ':y=(h/1.75)' \
                      ':alpha={fadeout_filter}'.format(formatted_text=formatted_text,
                                                       fadeout_filter=alpha_fadeout_filter,
                                                       new_width=new_width,
                                                       font_size_divisor=font_size_divisor)
    return drawtext_filter


def comma_escape(string):
    escaped_str = string.replace(',', '\,')
    return escaped_str
