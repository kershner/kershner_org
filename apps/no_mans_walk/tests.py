import json
from datetime import datetime, timezone
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Planet, PlanetVisit


@override_settings(NO_MANS_WALK_API_TOKEN='test-ingestion-token')
class PlanetIngestionTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test-ingestion-token')
        self.url = reverse('planets')
        self.entry = {
            'timestamp': '2026-10-13T22:30:00-04:00',
            'planet_hex': '116FA779F43A',
            'name': 'Elviadusca Enda',
            'galaxy_name': 'Dimonimba',
            'galaxy_index': 83,
            'biome': 'Lush',
            'weather': 'Broiling Humidity',
            'flora': 'Rich',
            'fauna': 'Full',
            'sentinels': 'Minimal',
            'has_rings': False,
        }

    def post(self, entries=None):
        return self.client.post(
            self.url, {'planets': entries if entries is not None else [self.entry]}, format='json',
        )

    def test_route_and_batch_creation(self):
        self.assertEqual(self.url, '/api/no_mans_walk/planets/')
        second = dict(self.entry, planet_hex='216FA779F43A', has_rings=True)
        response = self.post([self.entry, second])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'planets_created': 2, 'planets_updated': 0, 'visits_created': 2,
        })
        planet = Planet.objects.get(planet_hex=self.entry['planet_hex'])
        for field, value in self.entry.items():
            if field != 'timestamp':
                self.assertEqual(getattr(planet, field), value)
        self.assertEqual(planet.visits.get().timestamp, datetime(2026, 10, 14, 2, 30, tzinfo=timezone.utc))

    def test_retries_and_equivalent_timestamps_are_idempotent(self):
        self.assertEqual(self.post().status_code, 200)
        self.entry['timestamp'] = '2026-10-14T02:30:00Z'
        self.entry['planet_hex'] = self.entry['planet_hex'].lower()
        response = self.post()
        self.assertEqual(response.json(), {
            'planets_created': 0, 'planets_updated': 0, 'visits_created': 0,
        })
        self.assertEqual(Planet.objects.count(), 1)
        self.assertEqual(PlanetVisit.objects.count(), 1)

    def test_metadata_updates_without_duplicating_visit(self):
        self.post()
        self.entry.update(name='Renamed', weather='Calm', has_rings=True)
        response = self.post()
        self.assertEqual(response.json(), {
            'planets_created': 0, 'planets_updated': 1, 'visits_created': 0,
        })
        planet = Planet.objects.get()
        self.assertEqual((planet.name, planet.weather, planet.has_rings), ('Renamed', 'Calm', True))

    def test_new_visit_and_galaxy_identity(self):
        self.post()
        self.entry['timestamp'] = '2026-10-15T02:30:00Z'
        self.assertEqual(self.post().json()['visits_created'], 1)
        self.entry['galaxy_index'] = 84
        self.assertEqual(self.post().json()['planets_created'], 1)
        self.assertEqual(Planet.objects.count(), 2)
        self.assertEqual(PlanetVisit.objects.count(), 3)

    def test_duplicates_in_batch_use_final_metadata_and_unique_counts(self):
        second = dict(self.entry, name='Final name', timestamp='2026-10-15T02:30:00Z')
        response = self.post([self.entry, self.entry, second, second])
        self.assertEqual(response.json(), {
            'planets_created': 1, 'planets_updated': 0, 'visits_created': 2,
        })
        self.assertEqual(Planet.objects.get().name, 'Final name')

    def test_missing_wrong_and_malformed_tokens_rejected(self):
        for header in ('', 'Bearer wrong', 'Basic test-ingestion-token', 'Bearer',
                       'bearer test-ingestion-token', 'Bearer test-ingestion-token extra'):
            with self.subTest(header=header):
                self.client.credentials(HTTP_AUTHORIZATION=header)
                response = self.post()
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.json(), {'status': 'error', 'message': 'Unauthorized'})
        self.assertEqual(Planet.objects.count(), 0)

    def test_unconfigured_token_fails_closed(self):
        for token in ('', None):
            with self.subTest(token=token), override_settings(NO_MANS_WALK_API_TOKEN=token):
                self.assertEqual(self.post().status_code, 401)
        self.assertEqual(Planet.objects.count(), 0)

    def test_invalid_batch_shapes_and_json(self):
        for data in ({}, [], None, {'planets': []}, {'planets': {}}, {'planets': None},
                     {'planets': [None]}, {'planets': ['planet']}, {'planets': [1]}):
            with self.subTest(data=data):
                response = self.client.generic(
                    'POST', self.url, json.dumps(data), content_type='application/json',
                )
                self.assertEqual(response.status_code, 400)
                self.assertTrue(response.json())
        for data in ('{', b'\xff'):
            response = self.client.generic('POST', self.url, data, content_type='application/json')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(Planet.objects.count(), 0)

    def test_all_fields_required(self):
        for field in self.entry:
            if field == 'has_rings':
                continue
            with self.subTest(field=field):
                entry = dict(self.entry)
                del entry[field]
                response = self.post([entry])
                self.assertEqual(response.status_code, 400)
                self.assertIn(field, response.json()['planets'][0])

    def test_invalid_field_values_report_batch_index_and_field(self):
        invalid_values = {
            'planet_hex': ['', '116FA779F43AX', None],
            'timestamp': ['invalid', '2026-02-30T22:30:00Z', None, 123],
            'galaxy_index': [83.5, True, None],
            'has_rings': ['invalid', [], None],
        }
        for field in ('name', 'galaxy_name', 'biome', 'weather', 'flora', 'fauna', 'sentinels'):
            invalid_values[field] = ['', '   ', 'x' * 256, False, None, []]
        for field, values in invalid_values.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    invalid = dict(self.entry, **{field: value})
                    response = self.post([self.entry, invalid])
                    self.assertEqual(response.status_code, 400)
                    self.assertIn(field, response.json()['planets'][1])
        self.assertEqual(Planet.objects.count(), 0)
        self.assertEqual(PlanetVisit.objects.count(), 0)

    def test_omitted_rings_default_to_false_and_preserve_existing_values(self):
        entry = dict(self.entry)
        del entry['has_rings']
        self.assertEqual(self.post([entry]).status_code, 200)
        self.assertFalse(Planet.objects.get().has_rings)
        self.post([dict(entry, has_rings=True)])
        self.assertEqual(self.post([entry]).status_code, 200)
        self.assertTrue(Planet.objects.get().has_rings)

    def test_invalid_batch_does_not_update_existing_planet(self):
        self.post()
        response = self.post([dict(self.entry, name='Should not persist'), {}])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Planet.objects.get().name, self.entry['name'])
        self.assertEqual(PlanetVisit.objects.count(), 1)

    def test_database_failure_rolls_back_creates_and_updates(self):
        self.post()
        entries = [dict(self.entry, name='Should roll back'), dict(self.entry, planet_hex='216FA779F43A')]
        original = PlanetVisit.objects.get_or_create
        calls = 0

        def fail_second_visit(*args, **kwargs):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise IntegrityError('Simulated database failure')
            return original(*args, **kwargs)

        entries[0]['timestamp'] = '2026-10-15T02:30:00Z'
        with patch.object(PlanetVisit.objects, 'get_or_create', side_effect=fail_second_visit):
            with self.assertRaises(IntegrityError):
                self.post(entries)
        self.assertEqual(Planet.objects.count(), 1)
        self.assertEqual(Planet.objects.get().name, self.entry['name'])
        self.assertEqual(PlanetVisit.objects.count(), 1)

    def test_database_uniqueness_constraints(self):
        self.post()
        values = dict(self.entry)
        values.pop('timestamp')
        with self.assertRaises(IntegrityError), transaction.atomic():
            Planet.objects.create(**values)
        visit = PlanetVisit.objects.get()
        with self.assertRaises(IntegrityError), transaction.atomic():
            PlanetVisit.objects.create(planet=visit.planet, timestamp=visit.timestamp)

    def test_non_json_posts_and_other_write_methods_are_rejected(self):
        for method in ('put', 'patch', 'delete'):
            self.assertEqual(getattr(self.client, method)(self.url).status_code, 405)
        response = self.client.post(self.url, {'planets': 'data'}, format='multipart')
        self.assertEqual(response.status_code, 415)

    def test_get_is_public_and_lists_planet_metadata(self):
        self.post()
        self.client.credentials()
        with override_settings(NO_MANS_WALK_API_TOKEN=''):
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)
        planet = response.json()['results'][0]
        self.assertEqual(planet['id'], Planet.objects.get().pk)
        for field, value in self.entry.items():
            if field != 'timestamp':
                self.assertEqual(planet[field], value)
        self.assertEqual(self.post().status_code, 401)

    def test_get_filters_searches_and_orders_planets(self):
        self.post([
            self.entry,
            dict(self.entry, planet_hex='216FA779F43A', name='Alpha', has_rings=True),
            dict(self.entry, galaxy_index=84, name='Beta', biome='Barren'),
        ])
        self.client.credentials()
        response = self.client.get(self.url, {'galaxy_index': 83, 'has_rings': 'true'})
        self.assertEqual(response.json()['count'], 1)
        self.assertEqual(response.json()['results'][0]['name'], 'Alpha')
        response = self.client.get(self.url, {'biome': 'Barren'})
        self.assertEqual(response.json()['results'][0]['name'], 'Beta')
        response = self.client.get(self.url, {'search': 'elviadusca'})
        self.assertEqual(response.json()['count'], 1)
        response = self.client.get(self.url, {'ordering': '-name'})
        self.assertEqual(
            [planet['name'] for planet in response.json()['results']],
            ['Elviadusca Enda', 'Beta', 'Alpha'],
        )
        self.assertEqual(self.client.get(self.url, {'galaxy_index': 'invalid'}).status_code, 400)

    def test_get_paginates_with_stable_default_ordering(self):
        self.post([
            dict(self.entry, planet_hex=f'{index:012X}', name=f'Planet {index:02}')
            for index in reversed(range(12))
        ])
        self.client.credentials()
        response = self.client.get(self.url)
        self.assertEqual(response.json()['count'], 12)
        self.assertEqual(len(response.json()['results']), 10)
        self.assertIsNotNone(response.json()['next'])
        self.assertEqual(response.json()['results'][0]['name'], 'Planet 00')
        response = self.client.get(self.url, {'page': 2})
        self.assertEqual(
            [planet['name'] for planet in response.json()['results']],
            ['Planet 10', 'Planet 11'],
        )
