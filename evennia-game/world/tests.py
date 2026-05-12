"""
Evennia migration smoke/unit tests for clean-room DR systems.
"""

from django.test import SimpleTestCase, TestCase

from world.dr_data import GUILDS, RACES, SKILLSETS, build_starter_skills
from world.dr_guilds import join_guild
from world.dr_identity import choose_race, normalize_race_token
from world.dr_progression import advance_circle, primary_skill_for_guild, resolve_skill_id, train_skill
from world.dr_world import ROOMS, START_ROOM_ID, build_crossing_world, find_built_room, find_path, guild_registrar_rooms, validate_world_graph


class DRDataTests(SimpleTestCase):
    def test_canonical_race_count(self):
        self.assertEqual(len(RACES), 11)

    def test_skillset_counts_match_current_catalog(self):
        self.assertEqual(len(build_starter_skills()), 67)
        self.assertEqual(len(SKILLSETS["armor"]), 7)
        self.assertEqual(len(SKILLSETS["weapon"]), 19)
        self.assertEqual(len(SKILLSETS["magic"]), 12)
        self.assertEqual(len(SKILLSETS["survival"]), 12)
        self.assertEqual(len(SKILLSETS["lore"]), 13)
        self.assertEqual(len(SKILLSETS["guild"]), 11)

    def test_guild_primary_skills(self):
        self.assertEqual(primary_skill_for_guild("barbarian"), "expertise")
        self.assertEqual(primary_skill_for_guild("ranger"), "instinct")
        self.assertEqual(primary_skill_for_guild("warrior_mage"), "summoning")
        self.assertEqual(primary_skill_for_guild("commoner"), "athletics")


class DRWorldTests(SimpleTestCase):
    def test_crossing_world_graph_is_valid(self):
        self.assertEqual(validate_world_graph(), [])
        self.assertIn(START_ROOM_ID, ROOMS)
        self.assertGreaterEqual(len(ROOMS), 25)

    def test_all_guild_registrars_exist(self):
        registrars = guild_registrar_rooms()
        self.assertEqual(len(registrars), 11)
        self.assertEqual(registrars["barbarian"], "crossing-GU10-001")
        self.assertEqual(registrars["warrior_mage"], "crossing-GU11-001")

    def test_all_guild_registrars_are_reachable_from_town_green(self):
        for room_id in guild_registrar_rooms().values():
            self.assertTrue(find_path(START_ROOM_ID, room_id), f"Expected path to {room_id}")

    def test_hunting_rooms_are_reachable_from_town_green(self):
        self.assertEqual(find_path(START_ROOM_ID, "crossing-RV02-002"), ["south", "south", "east"])
        self.assertTrue(find_path(START_ROOM_ID, "crossing-RV02-005"))


class DRWorldBuilderTests(TestCase):
    def test_build_crossing_world_creates_rooms_and_exits(self):
        result = build_crossing_world()
        self.assertTrue(result["ok"])
        self.assertEqual(result["created_rooms"], len(ROOMS))
        town_green = find_built_room(START_ROOM_ID)
        self.assertIsNotNone(town_green)
        self.assertEqual(town_green.key, "Crossing Town Green")
        self.assertEqual(town_green.db.dr_room_id, START_ROOM_ID)
        self.assertIn(START_ROOM_ID.lower(), town_green.aliases.all())
        self.assertEqual(len(town_green.exits), len(ROOMS[START_ROOM_ID]["exits"]))

    def test_build_crossing_world_is_idempotent(self):
        first = build_crossing_world()
        second = build_crossing_world()
        self.assertTrue(first["ok"])
        self.assertTrue(second["ok"])
        self.assertEqual(second["created_rooms"], 0)
        self.assertGreaterEqual(second["updated_rooms"], len(ROOMS))
        self.assertEqual(second["created_exits"], 0)

    def test_built_guild_room_metadata(self):
        build_crossing_world()
        room = find_built_room("crossing-GU10-001")
        self.assertEqual(room.db.guild, "barbarian")
        self.assertEqual(room.db.dr_room_id, "crossing-GU10-001")

    def test_built_hunting_room_metadata(self):
        build_crossing_world()
        room = find_built_room("crossing-RV02-002")
        self.assertEqual(room.db.targets, ("rv-wolf-cub",))


class DRGuildTests(SimpleTestCase):
    def test_join_guild_requires_registrar_room(self):
        state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 1}
        result = join_guild(state, {})
        self.assertFalse(result["joined"])
        self.assertEqual(result["events"], ["There is no guild registrar here."])

    def test_all_canonical_guilds_can_be_joined_from_registrar_metadata(self):
        for guild_id, guild_name in GUILDS.items():
            state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 1}
            result = join_guild(state, {"guild": guild_id})
            self.assertTrue(result["joined"])
            self.assertEqual(state["guild_id"], guild_id)
            self.assertEqual(state["guild_name"], guild_name)
            self.assertEqual(state["circle"], 1)

    def test_join_guild_rejects_existing_guild(self):
        state = {"guild_id": "barbarian", "guild_name": "Barbarian Guild", "circle": 1}
        result = join_guild(state, {"guild": "bard"})
        self.assertFalse(result["joined"])
        self.assertIn("already registered", result["events"][0])

    def test_join_guild_rejects_unknown_registrar(self):
        state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 1}
        result = join_guild(state, {"guild": "fighter"})
        self.assertFalse(result["joined"])
        self.assertIn("not recognized", result["events"][0])


class DRProgressionTests(SimpleTestCase):
    def test_resolve_spaced_skill_names_and_legacy_scouting(self):
        skills = build_starter_skills()
        self.assertEqual(resolve_skill_id(skills, "Primary Magic"), "primary_magic")
        self.assertEqual(resolve_skill_id(skills, "bardic lore"), "bardic_lore")
        self.assertEqual(resolve_skill_id(skills, "scouting"), "instinct")

    def test_train_primary_skill_ranks_up(self):
        state = {"guild_id": "barbarian", "skills": build_starter_skills()}
        events = train_skill(state)
        self.assertIn("Expertise improves to rank 1.", events)
        self.assertIn("You drill Expertise.", events)
        self.assertEqual(state["skills"]["expertise"]["rank"], 1)

    def test_circle_requires_guild(self):
        state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 1, "skills": build_starter_skills()}
        events = advance_circle(state)
        self.assertIn("You need to join a guild before you can advance circles.", events)
        self.assertEqual(state["circle"], 1)

    def test_advance_to_circle_two(self):
        skills = build_starter_skills()
        skills["expertise"]["rank"] = 4
        skills["athletics"]["rank"] = 2
        state = {"guild_id": "barbarian", "guild_name": "Barbarian Guild", "circle": 1, "skills": skills}
        events = advance_circle(state)
        self.assertIn("You advance to Circle 2.", events)
        self.assertEqual(state["circle"], 2)


class DRIdentityTests(SimpleTestCase):
    def test_race_aliases(self):
        self.assertEqual(normalize_race_token("Gor'Tog"), "gor_tog")
        self.assertEqual(normalize_race_token("S'Kra Mur"), "s_raeth")

    def test_all_canonical_races_can_be_chosen_at_circle_one(self):
        for race_id, race_name in RACES.items():
            state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 1}
            result = choose_race(state, race_id)
            self.assertTrue(result["changed"])
            self.assertEqual(state["race"], race_id)
            self.assertEqual(state["race_name"], race_name)
            self.assertEqual(state["guild_id"], "commoner")
            self.assertEqual(state["guild_name"], "Unaffiliated")
            self.assertEqual(state["circle"], 1)

    def test_invalid_race_is_rejected(self):
        state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 1}
        result = choose_race(state, "orc")
        self.assertFalse(result["changed"])
        self.assertIn('Unknown race "orc".', result["events"][0])

    def test_race_cannot_change_after_guild_join(self):
        state = {"guild_id": "barbarian", "guild_name": "Barbarian Guild", "circle": 1}
        result = choose_race(state, "elf")
        self.assertFalse(result["changed"])
        self.assertIn("Race can only be chosen before joining a guild", result["events"][0])

    def test_race_cannot_change_after_circle_one(self):
        state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 2}
        result = choose_race(state, "elf")
        self.assertFalse(result["changed"])
        self.assertIn("Race can only be chosen before joining a guild", result["events"][0])
