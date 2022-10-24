from django.contrib.staticfiles import finders
import subprocess
import math


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
    audio_path = finders.find('audio/laura_palmer_theme.mp3')
    ffmpeg_cmd = ['ffmpeg',
                  '-y',
                  '-i', '{}'.format(downloaded_filename),
                  '-i', '{}'.format(audio_path),
                  '-filter_complex', get_complex_filter_str(whoosh),
                  '-map', '0:v',
                  '-map', '[a]',
                  '-ac', '2',
                  '-crf', '17',
                  '-t', '15', '{}'.format(output_filename)]

    ffmpeg_result = subprocess.run(ffmpeg_cmd,
                                   stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE,
                                   universal_newlines=True)
    # print(ffmpeg_result)
    return ffmpeg_result


def run_whoosh_thumbnail_ffmpeg(video_filename, thumbnail_output_filename):
    # Generate thumbnail
    ffmpeg_thumbnail_command = 'ffmpeg ' \
                               '-ss {} ' \
                               '-i {} ' \
                               '-vframes 1 ' \
                               '-f mjpeg ' \
                               '-vf ' \
                               'scale=640:-2:force_original_aspect_ratio=decrease {}'.format(5,
                                                                                             video_filename,
                                                                                             thumbnail_output_filename)
    ffmpeg_thumbnail_result = subprocess.run(ffmpeg_thumbnail_command,
                                             stdout=subprocess.PIPE,
                                             stderr=subprocess.PIPE,
                                             universal_newlines=True)
    return ffmpeg_thumbnail_result


def get_complex_filter_str(whoosh):
    source_mix = 1.0
    if whoosh.mute_original:
        source_mix = 0.0

    filter_str = '[0:a]volume={}[vol];[vol][1:a]amerge[a]'.format(source_mix)

    drawtext_str = None
    if whoosh.credit_text:
        drawtext_str = '[0]{}'.format(get_formatted_credit_text(whoosh))

    if drawtext_str:
        filter_str = '{};{}'.format(filter_str, drawtext_str)

    return filter_str


# Split the text into multiple lines if it's too long
def get_formatted_credit_text(whoosh):
    word_list = whoosh.credit_text.upper().split(' ')
    num_words = len(word_list)
    word_limit = math.ceil(whoosh.video_width / (whoosh.video_width / 4))
    num_lines = math.ceil(num_words / word_limit)
    lines = []
    index_pointer = 0
    first_line_length = 0
    for index, line in enumerate(range(0, num_lines)):
        new_line = ' '.join(word_list[index_pointer:index_pointer + word_limit])
        if index == 0:
            first_line_length = len(new_line)
        else:
            line_length = len(new_line)
            line_diff = abs(first_line_length - line_length)
            if line_diff % 2 != 0:
                line_diff += 1

            padding = ' '.join([' ' for x in range(0, math.ceil(line_diff / 2) - 1)])
            new_line = '{}{}{}'.format(padding, new_line, padding)

        lines.append(new_line)
        index_pointer += word_limit

    return get_credit_text_filter('\r'.join(lines), whoosh.video_width)


def get_credit_text_filter(text, video_width):
    # font_size = "(w/14)"
    font_size = "72"
    if video_width < 1600:
        font_size = "62"
    if video_width < 1000:
        font_size = "42"
    if video_width < 600:
        font_size = "28"
    if video_width < 300:
        font_size = "18"

    return get_drawtext_filter(text, font_size=font_size, x="(w-text_w)/2", y="(h/1.75)")


def get_drawtext_filter(text, font_size, x, y):
    # At 2 seconds, fade in over 2 seconds, display text for 5 seconds, then fade out over 2 seconds
    fadeout_filter = comma_escape('if(lt(t,2),0,if(lt(t,4),(t-2)/2,if(lt(t,9),1,if(lt(t,11),(2-(t-9))/2,0))))')
    drawtext_filter = 'drawtext=' \
                      ':font=Arial' \
                      ':text={}' \
                      ':borderw=1:bordercolor=0x33cc33' \
                      ':shadowx=0:shadowy=3' \
                      ':fontcolor=0x663333' \
                      ':fontsize={}' \
                      ':x={}' \
                      ':y={}' \
                      ':alpha={}'.format(text, font_size, x, y, fadeout_filter)
    return drawtext_filter


def comma_escape(string):
    escaped_str = string.replace(',', '\,')
    return escaped_str
