import subprocess
import logging
import os


logger = logging.getLogger('kershner.tasks')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
AUDIO_PATH = os.path.join(os.path.join(BASE_DIR, 'static'), 'audio')
FONT_SIZE_DIVISOR = 15
PORTRAIT_FONT_SIZE_DIVISOR = 10
LINE_CHARACTER_LIMIT = 20
PORTRAIT_LINE_CHARACTER_LIMIT = 14
PORTRAIT_RATIO = 9/16
FINAL_VIDEO_W_OR_H = 600
THUMB_WIDTH = 160
THUMB_STARTING_SECONDS = 4
WHOOSH_DURATION = 15


def ffprobe(file_path):
    ffprobe_cmd = ['ffprobe',
                   '-v', 'quiet',
                   '-print_format', 'json',
                   '-show_format',
                   '-show_streams',
                   '-show_error',
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
    audio_path = '{}/{}.mp3'.format(AUDIO_PATH, whoosh.get_whoosh_type_display().lower())
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
                  '-shortest',
                  '-t', '{}'.format(WHOOSH_DURATION),
                  '{}'.format(output_filename)]

    ffmpeg_result = subprocess.run(ffmpeg_cmd,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE,
                                   universal_newlines=True)
    # if settings.DEBUG:
    # subprocess.run("clip", universal_newlines=True, input=' '.join(ffmpeg_cmd))
    # print("==============================")
    # print(ffmpeg_result)

    return ffmpeg_result


def run_whoosh_thumbnail_ffmpeg(video_filename, thumbnail_output_filename):
    # Generate thumbnail
    vf_str = 'scale={}:-2:force_original_aspect_ratio=decrease'.format(THUMB_WIDTH)
    ffmpeg_command = ['ffmpeg',
                      '-ss', '{}'.format(THUMB_STARTING_SECONDS),
                      '-i', '{}'.format(video_filename),
                      '-vframes', '1',
                      '-f', 'mjpeg',
                      '-vf', vf_str,
                      thumbnail_output_filename]
    ffmpeg_thumbnail_result = subprocess.run(ffmpeg_command,
                                             stdout=subprocess.PIPE,
                                             stderr=subprocess.PIPE,
                                             universal_newlines=True)
    return ffmpeg_thumbnail_result


def get_complex_filter_str(whoosh):
    video_filter = []

    # Zoom/pan
    if whoosh.slow_zoom:
        zoompan_filter = 'zoompan=z=\'min(max(zoom,pzoom)+0.0015,1.5)\':d=0:s={}x{}'.format(whoosh.video_width,
                                                                                          whoosh.video_height)
        video_filter.append(zoompan_filter)

    # Cropping
    crop_or_scale_str = 'scale={}:-2'.format(FINAL_VIDEO_W_OR_H)
    if whoosh.can_be_cropped and whoosh.portrait or whoosh.video_height > whoosh.video_width:
        crop_or_scale_str = "crop=in_h*{}:in_h,scale=-2:{}".format(PORTRAIT_RATIO, FINAL_VIDEO_W_OR_H)

    video_filter.append(crop_or_scale_str)

    # Black and white
    if whoosh.black_and_white:
        bw_filter = 'hue=s=0'
        video_filter.append(bw_filter)

    # Slow mo
    if whoosh.slow_motion:
        slomo_filter = 'setpts=3*PTS'
        video_filter.append(slomo_filter)

    # Audio mixing
    source_mix = 1.0
    if whoosh.whoosh_type == 'om':
        source_mix = 0.7
    if whoosh.mute_source:
        source_mix = 0.0

    video_filter_str = ','.join(video_filter)

    final_filter_str = []

    # Reverse
    areverse_str = ''
    if whoosh.reverse:
        areverse_str = 'areverse,'
        final_filter_str.append('[0:v]trim=start={}:duration={},reverse[v]'.format(whoosh.start_time, WHOOSH_DURATION))

    final_filter_str += [
        '[0:a]{areverse_str}volume={source_mix},apad[vol]'.format(areverse_str=areverse_str, source_mix=source_mix),
        '[vol][1:a]amerge[a];[v]{video_filter_str}'.format(video_filter_str=video_filter_str)
    ]

    filter_str = ';'.join(final_filter_str)
    formatted_text = get_formatted_credit_text(whoosh)
    drawtext_str = get_drawtext_filter(whoosh, formatted_text)

    return '{},{}[filtered_video]'.format(filter_str, drawtext_str)


# Split the text into multiple lines if it's too long
def get_formatted_credit_text(whoosh):
    word_list = [' ']
    if whoosh.credit_text:
        word_list = escape_str_for_ffmpeg(whoosh.credit_text.upper()).split(' ')

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
    # At 2 seconds, fade in over 1 second, display text for 5 seconds, then fade out over 2 seconds
    alpha_anim = escape_str_for_ffmpeg('if(lt(t,2),0,if(lt(t,3),(t-2)/1,if(lt(t,8),1,if(lt(t,10),(2-(t-8))/2,0))))')

    new_width = FINAL_VIDEO_W_OR_H
    font_size_divisor = FONT_SIZE_DIVISOR
    if whoosh.portrait:
        new_width = int(FINAL_VIDEO_W_OR_H * PORTRAIT_RATIO)
        font_size_divisor = PORTRAIT_FONT_SIZE_DIVISOR

    border_w = 1.5
    shadow_y = 3.9
    drawtext_filter = 'drawtext=' \
                      ':font=Arial' \
                      ':text={formatted_text}' \
                      ':borderw={border_w}:bordercolor=0x33cc33' \
                      ':shadowx=0:shadowy={shadow_y}' \
                      ':fontcolor=0x663333' \
                      ':fontsize={new_width}/{font_size_divisor}' \
                      ':x=(w-text_w)/2' \
                      ':line_spacing=10' \
                      ':y=(h/1.75)' \
                      ':alpha={fadeout_filter}'.format(formatted_text=formatted_text,
                                                       fadeout_filter=alpha_anim,
                                                       new_width=new_width,
                                                       font_size_divisor=font_size_divisor,
                                                       border_w=border_w,
                                                       shadow_y=shadow_y)
    return drawtext_filter


def escape_str_for_ffmpeg(string):
    escaped_str = string.replace(',', '\,').replace("'", '').replace(":", '')
    return escaped_str
