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
    final_w_or_h = 1200
    filter_str = '[0:v]'

    # Zoom/pan
    if whoosh.slow_zoom:
        zoompan_filter = "zoompan=z='min(max(zoom,pzoom)+0.0015,1.5)':d=0,"
        filter_str = '{}{}'.format(filter_str, zoompan_filter)

    # Cropping
    if whoosh.can_be_cropped and whoosh.portrait:
        ratio = 4/5
        crop_and_scale_str = "crop=in_h*{}:in_h,scale=-2:{}".format(ratio, final_w_or_h)
        filter_str = '{}{}'.format(filter_str, crop_and_scale_str)
    else:
        scale_str = 'scale={}:-2'.format(final_w_or_h)
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
    if whoosh.mute_original:
        source_mix = 0.0

    filter_str = '[0:a]volume={}[vol];[vol][1:a]amerge[a];{}'.format(source_mix, filter_str)
    formatted_text = get_formatted_credit_text(whoosh)
    drawtext_str = '{}'.format(get_drawtext_filter(whoosh, formatted_text))

    return '{},{}[filtered_video]'.format(filter_str, drawtext_str)


# Split the text into multiple lines if it's too long
def get_formatted_credit_text(whoosh):
    word_list = [' ']
    if whoosh.credit_text:
        word_list = whoosh.credit_text.upper().split(' ')

    split_lines, max_line_length = get_text_with_line_breaks(whoosh, word_list)
    padded_lines = get_padded_text_lines(split_lines, max_line_length)

    return '\r'.join(padded_lines)


# Split text into multiple lines based on arbitrary word_per_line limit
# Returns list of lines and max_line_length, which is used to determine padding
def get_text_with_line_breaks(whoosh, word_list):
    word_limit_per_line = 3
    portrait_character_limit = 25
    num_words = len(word_list)
    num_lines = math.ceil(num_words / word_limit_per_line)
    index_pointer = 0
    max_line_length = 0

    # Check if we need to reduce the word_per_line value for portrait videos
    if whoosh.portrait:
        for num in range(0, num_lines):
            new_line = ' '.join(word_list[index_pointer:index_pointer + word_limit_per_line])
            if len(new_line) > portrait_character_limit:
                word_limit_per_line = 2
                break

            index_pointer += word_limit_per_line

    index_pointer = 0
    split_lines = []
    for num in range(0, num_lines):
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


def get_drawtext_filter(whoosh, formatted_text):
    # At 2 seconds, fade in over 2 seconds, display text for 5 seconds, then fade out over 2 seconds
    alpha_fadeout_filter = comma_escape('if(lt(t,2),0,if(lt(t,4),(t-2)/2,if(lt(t,9),1,if(lt(t,11),(2-(t-9))/2,0))))')
    font_size_denom = '15' if whoosh.portrait else '20'
    formatted_text = formatted_text.replace("'", '')

    drawtext_filter = 'drawtext=' \
                      ':font=Arial' \
                      ':text={formatted_text}' \
                      ':borderw=1:bordercolor=0x33cc33' \
                      ':shadowx=0:shadowy=2' \
                      ':fontcolor=0x663333' \
                      ':fontsize=w/{font_size_denom}' \
                      ':x=(w-text_w)/2' \
                      ':line_spacing=10' \
                      ':y=(h/1.75)' \
                      ':alpha={fadeout_filter}'.format(formatted_text=formatted_text,
                                                       fadeout_filter=alpha_fadeout_filter,
                                                       font_size_denom=font_size_denom)
    return drawtext_filter


def comma_escape(string):
    escaped_str = string.replace(',', '\,')
    return escaped_str
