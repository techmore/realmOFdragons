"""
Evennia migration smoke/unit tests for clean-room DR systems.
"""

from django.test import SimpleTestCase, TestCase
from evennia.utils.create import create_object, create_script

from world.dr_data import GUILDS, RACES, SKILLSETS, build_starter_skills
from world.dr_combat import ENEMIES, combat_pressure_scripts, respawn_room_enemies, room_enemy_ids
from world.dr_economy import ITEMS, SHOPS
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
        self.assertGreaterEqual(result["created_npcs"], 3)
        town_green = find_built_room(START_ROOM_ID)
        self.assertIsNotNone(town_green)
        self.assertEqual(town_green.key, "Crossing Town Green")
        self.assertEqual(town_green.db.dr_room_id, START_ROOM_ID)
        self.assertTrue(town_green.db.shop)
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
        self.assertEqual(second["created_npcs"], 0)
        self.assertGreaterEqual(second["updated_npcs"], 3)
        self.assertEqual(second["created_enemies"], 0)
        self.assertGreaterEqual(second["updated_enemies"], 4)
        self.assertEqual(second["created_respawn_scripts"], 0)
        self.assertGreaterEqual(second["updated_respawn_scripts"], 4)

    def test_built_guild_room_metadata(self):
        build_crossing_world()
        room = find_built_room("crossing-GU10-001")
        self.assertEqual(room.db.guild, "barbarian")
        self.assertEqual(room.db.dr_room_id, "crossing-GU10-001")

    def test_built_hunting_room_metadata(self):
        build_crossing_world()
        room = find_built_room("crossing-RV02-002")
        self.assertEqual(room.db.targets, ("rv-wolf-cub",))

    def test_built_shopkeeper_npcs(self):
        build_crossing_world()
        for room_id, shop in SHOPS.items():
            room = find_built_room(room_id)
            shopkeepers = [
                obj
                for obj in room.contents
                if obj.db.npc_type == "shopkeeper" and obj.db.shop_room_id == room_id
            ]
            self.assertEqual(len(shopkeepers), 1)
            self.assertEqual(shopkeepers[0].key, shop["keeper"])
            self.assertEqual(shopkeepers[0].db.shop_name, shop["name"])

    def test_built_enemy_npcs(self):
        build_crossing_world()
        for room_id, data in ROOMS.items():
            for enemy_id in data.get("targets", ()):
                room = find_built_room(room_id)
                enemies = [
                    obj
                    for obj in room.contents
                    if obj.db.npc_type == "enemy" and obj.db.enemy_id == enemy_id
                ]
                self.assertEqual(len(enemies), 1)
                self.assertEqual(enemies[0].key, ENEMIES[enemy_id]["name"])

    def test_built_hunting_rooms_have_respawn_scripts(self):
        build_crossing_world()
        for room_id, data in ROOMS.items():
            if not data.get("targets"):
                continue
            room = find_built_room(room_id)
            scripts = [
                script
                for script in room.scripts.all()
                if script.db.script_marker == "dr_room_respawn"
            ]
            self.assertEqual(len(scripts), 1)


class DRCommandSmokeTests(TestCase):
    def make_character(self, key):
        build_crossing_world()
        start = find_built_room(START_ROOM_ID)
        character = create_object(
            "typeclasses.characters.Character",
            key=key,
            location=start,
            home=start,
        )
        character.db.guild_id = "commoner"
        character.db.guild_name = "Unaffiliated"
        character.db.circle = 1
        character.db.skills = build_starter_skills()
        character.db.wallet = {"plat": 0, "trias": 100, "lucan": 0, "silk": 0}
        character.db.inventory = []
        character.db.hands = {"left": None, "right": None}
        character.db.engagement = {"target": None, "range": None}
        character.db.balance = "balanced"
        character.db.roundtime = 0
        character.db.stance = "balanced"
        character.db.max_health = 30
        character.db.health = 30
        return character

    def walk_to_room(self, character, destination_room_id):
        current_room_id = character.location.db.dr_room_id
        for direction in find_path(current_room_id, destination_room_id):
            exit_obj = next(
                (
                    candidate
                    for candidate in character.location.exits
                    if candidate.key == direction
                ),
                None,
            )
            self.assertIsNotNone(
                exit_obj,
                f"Missing exit {direction!r} from {current_room_id!r}",
            )
            character.move_to(exit_obj.destination, quiet=True)
            current_room_id = character.location.db.dr_room_id
        self.assertEqual(character.location.db.dr_room_id, destination_room_id)

    def train_and_circle_to(self, character, target_circle):
        attempts = 0
        while character.db.circle < target_circle and attempts < 500:
            attempts += 1
            previous_circle = character.db.circle
            character.execute_cmd("circle")
            if character.db.circle > previous_circle:
                continue
            character.execute_cmd("train")
        self.assertEqual(
            character.db.circle,
            target_circle,
            f"{character.key} did not reach Circle {target_circle}",
        )

    def test_join_guild_requires_a_registrar_room_command(self):
        character = self.make_character("Registrar Gate Smoke")
        character.execute_cmd("join guild")
        self.assertEqual(character.db.guild_id, "commoner")
        self.assertEqual(character.db.guild_name, "Unaffiliated")

    def test_all_guilds_join_and_reach_circle_ten_through_commands(self):
        registrars = guild_registrar_rooms()

        for guild_id, guild_name in GUILDS.items():
            character = self.make_character(f"{guild_name} Smoke")
            self.walk_to_room(character, registrars[guild_id])

            character.execute_cmd("join guild")
            self.assertEqual(character.db.guild_id, guild_id)
            self.assertEqual(character.db.guild_name, guild_name)

            self.train_and_circle_to(character, 10)

    def test_shop_buy_sell_inventory_and_hands_commands(self):
        character = self.make_character("Economy Smoke")

        character.execute_cmd("shop")
        character.execute_cmd("shop talk")
        character.execute_cmd("buy torch")
        self.assertIn("torch", character.db.inventory)
        self.assertEqual(character.db.wallet["trias"], 95)

        character.execute_cmd("inventory")
        character.execute_cmd("hands")
        character.execute_cmd("sell torch")
        self.assertNotIn("torch", character.db.inventory)
        self.assertEqual(character.db.wallet["trias"], 97)

    def test_shop_data_has_stock_and_dialogue(self):
        self.assertGreaterEqual(len(SHOPS), 3)
        for shop in SHOPS.values():
            self.assertTrue(shop["keeper"])
            self.assertTrue(shop["dialogue"])
            self.assertTrue(shop["stock"])
            for item_id in shop["stock"]:
                self.assertIn(item_id, ITEMS)

    def test_scan_target_advance_range_and_retreat_commands(self):
        character = self.make_character("Combat Smoke")
        self.walk_to_room(character, "crossing-RV02-002")

        character.execute_cmd("scan")
        character.execute_cmd("target rv-wolf-cub")
        self.assertEqual(character.db.engagement["target"], "rv-wolf-cub")
        self.assertEqual(character.db.engagement["range"], "missile")
        self.assertEqual(len(combat_pressure_scripts(character)), 1)

        character.execute_cmd("range")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "pole")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "melee")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["range"], "pole")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["range"], "missile")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(len(combat_pressure_scripts(character)), 0)

    def test_jab_requires_melee_and_defeats_enemy(self):
        character = self.make_character("Jab Smoke")
        self.walk_to_room(character, "crossing-RV02-004")

        character.execute_cmd("target rv-mud-beetle")
        character.execute_cmd("target rv-mud-beetle")
        self.assertEqual(len(combat_pressure_scripts(character)), 1)
        character.execute_cmd("jab")
        self.assertEqual(character.db.engagement["target"], "rv-mud-beetle")

        character.execute_cmd("advance")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "melee")

        character.execute_cmd("stance offensive")
        self.assertEqual(character.db.stance, "offensive")
        character.execute_cmd("jab")
        self.assertEqual(character.db.balance, "recovering")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.health, 27)
        beetle = next(
            obj
            for obj in character.location.contents
            if obj.db.npc_type == "enemy" and obj.db.enemy_id == "rv-mud-beetle"
        )
        self.assertEqual(beetle.db.vitality, 8)

        character.execute_cmd("attack")
        self.assertEqual(beetle.db.vitality, 8)
        self.assertEqual(character.db.roundtime, 1)
        character.execute_cmd("wait")
        self.assertEqual(character.db.balance, "balanced")
        self.assertEqual(character.db.roundtime, 0)

        character.execute_cmd("stance defensive")
        self.assertEqual(character.db.stance, "defensive")
        character.execute_cmd("attack")
        self.assertEqual(character.db.health, 26)
        character.execute_cmd("health")
        character.execute_cmd("recover")
        character.execute_cmd("attack")
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(len(combat_pressure_scripts(character)), 0)
        self.assertEqual(character.db.health, 26)
        self.assertEqual(character.db.wallet["trias"], 103)
        self.assertIn("torch", character.db.inventory)
        self.assertFalse(
            [
                obj
                for obj in character.location.contents
                if obj.db.npc_type == "enemy" and obj.db.enemy_id == "rv-mud-beetle"
            ]
        )
        self.assertEqual(room_enemy_ids(character.location), ())
        character.execute_cmd("scan")

        result = respawn_room_enemies(character.location)
        self.assertIn("Respawned: Mud Beetle.", result)
        self.assertEqual(room_enemy_ids(character.location), ("rv-mud-beetle",))
        character.execute_cmd("target rv-mud-beetle")
        self.assertEqual(character.db.engagement["target"], "rv-mud-beetle")
        self.assertEqual(len(combat_pressure_scripts(character)), 1)

    def test_recovery_and_respawn_scripts_tick_existing_helpers(self):
        character = self.make_character("Script Smoke")
        character.db.roundtime = 1
        character.db.balance = "recovering"
        recovery_script = create_script("typeclasses.scripts.RecoveryScript", obj=character)
        recovery_script.at_repeat()
        self.assertEqual(character.db.roundtime, 0)
        self.assertEqual(character.db.balance, "balanced")

        self.walk_to_room(character, "crossing-RV02-005")
        for obj in list(character.location.contents):
            if obj.db.npc_type == "enemy":
                obj.delete()
        self.assertEqual(room_enemy_ids(character.location), ())
        respawn_script = create_script("typeclasses.scripts.RoomRespawnScript", obj=character.location)
        respawn_script.at_repeat()
        self.assertEqual(room_enemy_ids(character.location), ("rv-ridge-hare",))

    def test_combat_pressure_script_damages_engaged_character(self):
        character = self.make_character("Pressure Smoke")
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("target rv-wolf-cub")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "pole")

        pressure_script = create_script("typeclasses.scripts.CombatPressureScript", obj=character)
        pressure_script.at_repeat()
        self.assertEqual(character.db.health, 26)

        character.execute_cmd("stance defensive")
        pressure_script.at_repeat()
        self.assertEqual(character.db.health, 25)

    def test_bash_defend_and_flee_commands(self):
        character = self.make_character("Maneuver Smoke")
        self.walk_to_room(character, "crossing-RV02-003")
        character.execute_cmd("target rv-boarlet")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        self.assertEqual(len(combat_pressure_scripts(character)), 1)

        character.execute_cmd("bash")
        boarlet = next(
            obj
            for obj in character.location.contents
            if obj.db.npc_type == "enemy" and obj.db.enemy_id == "rv-boarlet"
        )
        self.assertEqual(boarlet.db.vitality, 12)
        self.assertEqual(character.db.roundtime, 2)
        self.assertEqual(character.db.balance, "recovering")
        self.assertEqual(character.db.health, 28)

        character.execute_cmd("defend")
        self.assertEqual(character.db.stance, "defensive")
        self.assertEqual(character.db.roundtime, 0)
        self.assertEqual(character.db.balance, "balanced")

        character.execute_cmd("flee")
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.balance, "recovering")
        self.assertEqual(len(combat_pressure_scripts(character)), 0)

    def test_enemy_loot_tables_are_defined(self):
        for enemy in ENEMIES.values():
            self.assertIn("loot", enemy)
            self.assertIn("trias", enemy["loot"])
            self.assertIn("items", enemy["loot"])


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
