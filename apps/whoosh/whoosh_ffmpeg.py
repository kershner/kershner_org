from django.contrib.staticfiles import finders
import subprocess
import logging
import math


logger = logging.getLogger('whoosh.whoosh_ffmpeg')


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
    if whoosh.slow_motion:
        duration = '13.5'  # shorten clip overall because slomo causes slight audio sync issue

    audio_path = finders.find('audio/laura_palmer_theme_edit_2.mp3')
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
    width = whoosh.video_width
    height = whoosh.video_height

    vid_output_name = '0'
    filter_str = ''

    # Cropping
    if width and height and whoosh.crop_4_3:
        aspect_ratio = [2, 3]
        crop_w = height * aspect_ratio[0] / aspect_ratio[1]
        if crop_w <= width:
            crop_value = 'crop=ih/{}*{}:ih'.format(aspect_ratio[0], aspect_ratio[1])
        else:
            crop_value = 'crop=iw:iw*({}/{})'.format(aspect_ratio[0], aspect_ratio[1])

        dar_value = 'setdar=dar={}/{}'.format(aspect_ratio[0], aspect_ratio[1])
        filter_str = '[0:v]{}[cropped];[cropped]{}[{}];'.format(crop_value, dar_value, vid_output_name)

    # Black and white
    if whoosh.black_and_white:
        new_vid_output = 'bw'
        filter_str = '{}[{}]hue=s=0[{}];'.format(filter_str, vid_output_name, new_vid_output)
        vid_output_name = new_vid_output

    # Zoom/pan
    if whoosh.slow_zoom:
        new_vid_output = 'zoompan'
        filter_str = "{}[{}]zoompan=z='min(max(zoom,pzoom)+0.0015,1.5)':d=0[{}];".format(filter_str, vid_output_name,
                                                                                         new_vid_output)
        vid_output_name = new_vid_output

    # Slow mo
    if whoosh.slow_motion:
        new_vid_output = 'slomo'
        filter_str = '{}[{}]setpts=3*PTS[{}];'.format(filter_str, vid_output_name, new_vid_output)
        vid_output_name = new_vid_output

    # Audio mixing
    source_mix = 1.0
    if whoosh.mute_original:
        source_mix = 0.0

    filter_str = '[0:a]volume={}[vol];[vol][1:a]amerge[a];{}'.format(source_mix, filter_str)
    formatted_text = get_formatted_credit_text(whoosh)
    drawtext_str = '[{}]{}'.format(vid_output_name, get_drawtext_filter(formatted_text))

    return '{}{}[filtered_video]'.format(filter_str, drawtext_str)


# Split the text into multiple lines if it's too long
def get_formatted_credit_text(whoosh):
    word_list = [' ']
    if whoosh.credit_text:
        word_list = whoosh.credit_text.upper().split(' ')

    split_lines, max_line_length = get_text_with_line_breaks(word_list)
    padded_lines = get_padded_text_lines(split_lines, max_line_length)

    return '\r'.join(padded_lines)


# Split text into multiple lines based on arbitrary word_per_line limit
# Returns list of lines and max_line_length, which is used to determine padding
def get_text_with_line_breaks(word_list):
    word_limit_per_line = 3
    num_words = len(word_list)
    num_lines = math.ceil(num_words / word_limit_per_line)
    index_pointer = 0
    max_line_length = 0
    split_lines = []
    for num in enumerate(range(0, num_lines)):
        new_line = ' '.join(word_list[index_pointer:index_pointer + word_limit_per_line])

        if len(new_line) > max_line_length:
            max_line_length = len(new_line)

        split_lines.append(new_line)
        index_pointer += word_limit_per_line

    return split_lines, max_line_length


# Add padding (space character) to the start and end of lines that are less than max_line_length
# This is a way to fake center-aligned text
def get_padded_text_lines(split_lines, max_line_length):
    padded_lines = []
    for line in split_lines:
        line_length = len(line)

        line_diff = abs(max_line_length - line_length)
        if line_diff % 2 != 0:
            line_diff += 1

        padding_len = math.floor(line_diff / 2)
        padding = ' '.join([' ' for x in range(0, padding_len)])
        if line_length == max_line_length:
            padding = ''

        new_line = '{}{}{}'.format(padding, line, padding)
        padded_lines.append(new_line)

    return padded_lines


def get_drawtext_filter(text):
    # At 2 seconds, fade in over 2 seconds, display text for 5 seconds, then fade out over 2 seconds
    fadeout_filter = comma_escape('if(lt(t,2),0,if(lt(t,4),(t-2)/2,if(lt(t,9),1,if(lt(t,11),(2-(t-9))/2,0))))')
    drawtext_filter = 'drawtext=' \
                      ':font=Arial' \
                      ':text={}' \
                      ':borderw=1:bordercolor=0x33cc33' \
                      ':shadowx=0:shadowy=2' \
                      ':fontcolor=0x663333' \
                      ':fontsize=w/20' \
                      ':x=(w-text_w)/2' \
                      ':line_spacing=10' \
                      ':y=(h/1.75)' \
                      ':alpha={}'.format(text, fadeout_filter)
    return drawtext_filter


def comma_escape(string):
    escaped_str = string.replace(',', '\,')
    return escaped_str
