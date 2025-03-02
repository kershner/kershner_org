from apps.daggerwalk.models import Region


def get_map_data():
    """Fetch and structure region data for provinceShapes, regionMap, and regionData."""
    
    # Prefetch related objects for efficiency
    regions = Region.objects.prefetch_related(
        'map_parts', 
        'points_of_interest'
    ).select_related(
        'shape'
    ).exclude(name='Ocean')

    province_shapes = {}
    region_map = {}
    region_data = []

    for region in regions:
        # provinceShapes - Store polygon coordinates for each region
        if region.shape:
            province_shapes[region.name] = region.shape.coordinates

        # regionMap - Store FMAP mapping data
        if region.multi_part:
            fmap_parts = [
                {"fmap_image": part.fmap_image, "offset": {"x": part.offset_x, "y": part.offset_y}}
                for part in region.map_parts.all()
            ]
            region_map[region.name] = {
                "multi_part": True,
                "parts": fmap_parts,
                "region_index": region.region_index
            }
        else:
            region_map[region.name] = {
                "fmap_image": region.fmap_image,
                "offset": {"x": region.offset_x, "y": region.offset_y},
                "region_index": region.region_index
            }

        # regionData - Store general region details
        capital = region.points_of_interest.filter(type='capital').first()
        region_data.append({
            "name": region.name,
            "province": region.province,
            "climate": region.climate,
            "capital": {
                "name": capital.name,
                "mapPixelX": capital.map_pixel_x,
                "mapPixelY": capital.map_pixel_y
            } if capital else None
        })

    return {
        "provinceShapes": province_shapes,
        "regionMap": region_map,
        "regionData": region_data,
    }