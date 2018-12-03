import json
import os


def get_parameters():
    # Load params from JSON file
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_path = os.path.join(base_dir) + '/config'
    with open(config_path + '/parameters.json') as f:
        params = json.load(f)
        return params
