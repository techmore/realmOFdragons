"""
Evennia migration smoke/unit tests for clean-room DR systems.
"""

from django.test import SimpleTestCase, TestCase
from evennia.utils.create import create_account, create_object, create_script

from world.dr_data import GUILDS, RACES, RACE_STARTING_ATTRIBUTES, SKILLSETS, build_starter_skills
from world.dr_combat import ENEMIES, combat_pressure_scripts, corpse_objects, respawn_room_enemies, room_enemy_ids
from world.dr_economy import ITEMS, SHOPS
from world.dr_guilds import join_guild
from world.dr_identity import choose_race, normalize_race_token, reroll_attributes, roll_race_attributes
from world.dr_progression import advance_circle, guild_circle_perk, primary_skill_for_guild, resolve_skill_id, train_skill, unlocked_guild_perks
from world.dr_world import ROOMS, START_ROOM_ID, build_crossing_world, find_built_room, find_path, guild_registrar_rooms, validate_world_graph


class DRAccountCreationTests(TestCase):
    def test_account_create_character_command_creates_race_selected_commoner(self):
        account = create_account("CreationAccount", None, "test-password")
        account.execute_cmd("characters")
        account.execute_cmd("create character Aela = elf")
        characters = list(account.characters.all())
        self.assertEqual(len(characters), 1)
        character = characters[0]
        self.assertEqual(character.key, "Aela")
        self.assertEqual(character.db.race, "elf")
        self.assertEqual(character.db.race_name, "Elf")
        self.assertEqual(character.db.attributes, RACE_STARTING_ATTRIBUTES["elf"])
        self.assertTrue(character.db.creation_complete)
        self.assertEqual(character.db.guild_id, "commoner")
        self.assertEqual(character.db.guild_name, "Unaffiliated")
        self.assertEqual(character.db.circle, 1)
        self.assertEqual(character.location.db.dr_room_id, START_ROOM_ID)
        account.execute_cmd("characters")
        account.execute_cmd("roster")

    def test_account_roster_lists_multiple_characters(self):
        account = create_account("RosterAccount", None, "test-password")
        account.execute_cmd("create character Aela = elf")
        account.execute_cmd("create character Brin = human")
        self.assertEqual(len(list(account.characters.all())), 2)
        account.execute_cmd("characters")

    def test_account_create_character_rejects_duplicate_roster_name(self):
        account = create_account("DuplicateAccount", None, "test-password")
        account.execute_cmd("create character Aela = elf")
        account.execute_cmd("create character aela = human")
        characters = list(account.characters.all())
        self.assertEqual(len(characters), 1)
        self.assertEqual(characters[0].db.race, "elf")


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
        character.db.creation_complete = True
        character.db.circle = 1
        character.db.skills = build_starter_skills()
        character.db.wallet = {"plat": 0, "trias": 100, "lucan": 0, "silk": 0}
        character.db.inventory = []
        character.db.hands = {"left": None, "right": None}
        character.db.equipment = {"worn": []}
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

    def prepare_circle_two_requirements(self, character):
        primary = primary_skill_for_guild(character.db.guild_id)
        character.db.skills[primary]["rank"] = 4
        character.db.skills["athletics"]["rank"] = 2

    def test_join_guild_requires_a_registrar_room_command(self):
        character = self.make_character("Registrar Gate Smoke")
        character.execute_cmd("join guild")
        self.assertEqual(character.db.guild_id, "commoner")
        self.assertEqual(character.db.guild_name, "Unaffiliated")

    def test_new_character_must_choose_race_before_joining_guild(self):
        build_crossing_world()
        start = find_built_room(START_ROOM_ID)
        character = create_object(
            "typeclasses.characters.Character",
            key="Creation Smoke",
            location=start,
            home=start,
        )
        self.assertFalse(character.db.creation_complete)
        self.assertEqual(character.db.race, None)
        self.walk_to_room(character, guild_registrar_rooms()["barbarian"])

        character.execute_cmd("create character")
        self.assertFalse(character.db.creation_complete)
        character.execute_cmd("join guild")
        self.assertEqual(character.db.guild_id, "commoner")
        character.execute_cmd("create character elf")
        self.assertTrue(character.db.creation_complete)
        self.assertEqual(character.db.race, "elf")
        self.assertEqual(character.db.guild_id, "commoner")
        self.assertEqual(character.db.circle, 1)
        character.execute_cmd("score")
        character.execute_cmd("attributes")
        character.execute_cmd("stat agility")
        character.execute_cmd("reroll attributes smoke")
        self.assertNotEqual(character.db.attributes, RACE_STARTING_ATTRIBUTES["elf"])
        character.execute_cmd("join guild")
        self.assertEqual(character.db.guild_id, "barbarian")

    def test_all_guilds_join_and_reach_circle_ten_through_commands(self):
        registrars = guild_registrar_rooms()

        for guild_id, guild_name in GUILDS.items():
            character = self.make_character(f"{guild_name} Smoke")
            self.walk_to_room(character, registrars[guild_id])

            character.execute_cmd("join guild")
            self.assertEqual(character.db.guild_id, guild_id)
            self.assertEqual(character.db.guild_name, guild_name)
            self.assertEqual(character.db.guild_perks, [guild_circle_perk(guild_id, 1)])
            character.execute_cmd("guild")
            character.execute_cmd("circle status")
            self.assertEqual(character.db.circle, 1)

            self.train_and_circle_to(character, 10)
            self.assertEqual(len(character.db.guild_perks), 10)
            self.assertEqual(character.db.guild_perks[-1], guild_circle_perk(guild_id, 10))
            character.execute_cmd("perks")
            character.execute_cmd("circle")
            self.assertEqual(character.db.circle, 10)

    def test_circle_requires_own_guild_registrar_room_command(self):
        registrars = guild_registrar_rooms()
        character = self.make_character("Circle Registrar Smoke")
        self.walk_to_room(character, registrars["barbarian"])
        character.execute_cmd("join guild")
        self.prepare_circle_two_requirements(character)

        town_green = find_built_room(START_ROOM_ID)
        character.move_to(town_green, quiet=True)
        character.execute_cmd("circle")
        self.assertEqual(character.db.circle, 1)

        self.walk_to_room(character, registrars["bard"])
        character.execute_cmd("circle")
        self.assertEqual(character.db.circle, 1)

        self.walk_to_room(character, registrars["barbarian"])
        character.execute_cmd("circle")
        self.assertEqual(character.db.circle, 2)

    def test_joined_training_requires_own_guild_registrar_room_command(self):
        registrars = guild_registrar_rooms()
        character = self.make_character("Train Registrar Smoke")
        self.walk_to_room(character, registrars["barbarian"])
        character.execute_cmd("join guild")

        town_green = find_built_room(START_ROOM_ID)
        character.move_to(town_green, quiet=True)
        character.execute_cmd("train")
        self.assertEqual(character.db.skills["expertise"]["rank"], 0)

        self.walk_to_room(character, registrars["bard"])
        character.execute_cmd("train")
        self.assertEqual(character.db.skills["expertise"]["rank"], 0)

        self.walk_to_room(character, registrars["barbarian"])
        character.execute_cmd("train")
        self.assertEqual(character.db.skills["expertise"]["rank"], 1)

    def test_shop_buy_sell_inventory_and_hands_commands(self):
        character = self.make_character("Economy Smoke")

        character.execute_cmd("shop")
        character.execute_cmd("shop talk")
        character.execute_cmd("buy torch")
        self.assertIn("torch", character.db.inventory)
        self.assertTrue(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "torch"
            ]
        )
        self.assertEqual(character.db.wallet["trias"], 95)

        character.execute_cmd("inventory")
        character.execute_cmd("hands")
        character.execute_cmd("sell torch")
        self.assertNotIn("torch", character.db.inventory)
        self.assertFalse(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "torch"
            ]
        )
        self.assertEqual(character.db.wallet["trias"], 97)

    def test_wield_wear_and_equipment_commands(self):
        character = self.make_character("Equipment Smoke")
        self.walk_to_room(character, "crossing-RV02-002")

        character.execute_cmd("buy torch")
        character.execute_cmd("buy small_blade")
        character.execute_cmd("wield small_blade")
        self.assertEqual(character.db.hands["right"], "small_blade")
        self.assertNotIn("small_blade", character.db.inventory)
        self.assertTrue(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "small_blade"
            ]
        )

        character.execute_cmd("buy leather_shield")
        self.assertEqual(character.db.hands["left"], "leather_shield")
        character.execute_cmd("wear leather_shield")
        self.assertEqual(character.db.hands["left"], None)
        self.assertIn("leather_shield", character.db.equipment["worn"])
        self.assertTrue(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "leather_shield"
            ]
        )
        character.execute_cmd("equipment")

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
        character.execute_cmd("appraise rv-wolf-cub")
        character.execute_cmd("target rv-wolf-cub")
        self.assertEqual(character.db.engagement["target"], "rv-wolf-cub")
        self.assertEqual(character.db.engagement["range"], "missile")
        self.assertEqual(len(combat_pressure_scripts(character)), 1)

        character.execute_cmd("appraise target")
        character.execute_cmd("combat")
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
        character.execute_cmd("combat")

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
        self.assertEqual(character.db.skills["small_edged"]["pool"], 2)
        self.assertEqual(character.db.skills["tactics"]["pool"], 1)
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
        character.execute_cmd("defend")
        character.execute_cmd("bash")
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(len(combat_pressure_scripts(character)), 0)
        self.assertEqual(character.db.health, 26)
        self.assertEqual(character.db.wallet["trias"], 100)
        self.assertNotIn("torch", character.db.inventory)
        corpses = corpse_objects(character.location)
        self.assertEqual(len(corpses), 1)
        self.assertEqual(corpses[0].db.enemy_id, "rv-mud-beetle")
        self.assertEqual(corpses[0].db.loot_trias, 3)
        self.assertEqual(corpses[0].db.loot_items, ("torch",))
        self.assertEqual(
            [
                obj.db.item_id
                for obj in corpses[0].contents
                if obj.db.object_type == "item"
            ],
            ["torch"],
        )

        character.execute_cmd("loot corpse")
        self.assertEqual(character.db.wallet["trias"], 103)
        self.assertNotIn("torch", character.db.inventory)
        self.assertEqual(
            [
                obj.db.item_id
                for obj in character.location.contents
                if obj.db.object_type == "item"
            ],
            ["torch"],
        )
        character.execute_cmd("get torch")
        self.assertIn("torch", character.db.inventory)
        self.assertTrue(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "torch"
            ]
        )
        self.assertFalse(
            [
                obj
                for obj in character.location.contents
                if obj.db.object_type == "item" and obj.db.item_id == "torch"
            ]
        )
        self.assertEqual(corpse_objects(character.location), [])
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

    def test_race_attributes_and_weapon_skill_modify_combat_damage(self):
        character = self.make_character("Attribute Combat Smoke")
        character.db.race = "gor_tog"
        character.db.race_name = "Gor'Tog"
        character.db.attributes = RACE_STARTING_ATTRIBUTES["gor_tog"]
        character.db.skills["brawling"]["rank"] = 10
        self.walk_to_room(character, "crossing-RV02-003")
        character.execute_cmd("target rv-boarlet")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        character.execute_cmd("bash")
        boarlet = next(
            obj
            for obj in character.location.contents
            if obj.db.npc_type == "enemy" and obj.db.enemy_id == "rv-boarlet"
        )
        self.assertEqual(boarlet.db.vitality, 10)
        self.assertEqual(character.db.skills["brawling"]["pool"], 2)
        self.assertEqual(character.db.skills["tactics"]["pool"], 1)

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

    def test_corpse_decay_script_removes_unlooted_corpse(self):
        character = self.make_character("Corpse Decay Smoke")
        self.walk_to_room(character, "crossing-RV02-005")
        character.execute_cmd("target rv-ridge-hare")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        character.execute_cmd("bash")
        character.execute_cmd("defend")
        character.execute_cmd("bash")
        corpses = corpse_objects(character.location)
        self.assertEqual(len(corpses), 1)
        scripts = list(corpses[0].scripts.all())
        self.assertEqual(len(scripts), 1)
        scripts[0].at_repeat()
        self.assertEqual(corpse_objects(character.location), [])


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
        state = {"guild_id": "barbarian", "skills": build_starter_skills(), "room_guild_id": "barbarian"}
        events = train_skill(state)
        self.assertIn("Expertise improves to rank 1.", events)
        self.assertIn("You drill Expertise.", events)
        self.assertEqual(state["skills"]["expertise"]["rank"], 1)

    def test_train_requires_matching_guild_training_room(self):
        state = {"guild_id": "barbarian", "skills": build_starter_skills(), "room_guild_id": None}
        events = train_skill(state)
        self.assertEqual(events, ["You need a suitable training room or your guild registrar to train here."])
        state["room_guild_id"] = "bard"
        events = train_skill(state)
        self.assertEqual(events, ["This guildhall will not train your guild."])

    def test_circle_requires_guild(self):
        state = {"guild_id": "commoner", "guild_name": "Unaffiliated", "circle": 1, "skills": build_starter_skills()}
        events = advance_circle(state)
        self.assertIn("You need to join a guild before you can advance circles.", events)
        self.assertEqual(state["circle"], 1)

    def test_advance_to_circle_two(self):
        skills = build_starter_skills()
        skills["expertise"]["rank"] = 4
        skills["athletics"]["rank"] = 2
        state = {"guild_id": "barbarian", "guild_name": "Barbarian Guild", "circle": 1, "skills": skills, "room_guild_id": "barbarian"}
        events = advance_circle(state)
        self.assertIn("You advance to Circle 2.", events)
        self.assertIn("Milestone unlocked: Barbarian Guild Circle 2 recognition.", events)
        self.assertEqual(state["circle"], 2)
        self.assertEqual(state["guild_perks"], unlocked_guild_perks("barbarian", 2))

    def test_circle_requires_matching_guild_registrar_metadata(self):
        skills = build_starter_skills()
        skills["expertise"]["rank"] = 4
        skills["athletics"]["rank"] = 2
        state = {"guild_id": "barbarian", "guild_name": "Barbarian Guild", "circle": 1, "skills": skills, "room_guild_id": None}
        events = advance_circle(state)
        self.assertIn("You must stand before your guild registrar to advance circles.", events)
        self.assertEqual(state["circle"], 1)
        state["room_guild_id"] = "bard"
        events = advance_circle(state)
        self.assertIn("This registrar cannot advance your guild.", events)
        self.assertEqual(state["circle"], 1)

    def test_circle_ten_is_current_supported_cap(self):
        skills = build_starter_skills()
        skills["expertise"]["rank"] = 99
        skills["athletics"]["rank"] = 99
        state = {"guild_id": "barbarian", "guild_name": "Barbarian Guild", "circle": 10, "skills": skills, "room_guild_id": "barbarian"}
        events = advance_circle(state)
        self.assertIn("Circle 10 is the current supported cap for this Evennia port.", events)
        self.assertIn("You have reached the current Circle 10 cap.", events)
        self.assertEqual(state["circle"], 10)
        self.assertEqual(len(state["guild_perks"]), 10)


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
            self.assertEqual(state["attributes"], RACE_STARTING_ATTRIBUTES[race_id])
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

    def test_race_attribute_reroll_is_seeded_and_pre_guild_only(self):
        first = roll_race_attributes("elf", seed="smoke")
        second = roll_race_attributes("elf", seed="smoke")
        self.assertEqual(first, second)
        self.assertNotEqual(first, RACE_STARTING_ATTRIBUTES["elf"])

        state = {"race": "elf", "guild_id": "commoner", "circle": 1, "attributes": RACE_STARTING_ATTRIBUTES["elf"]}
        result = reroll_attributes(state, seed="smoke")
        self.assertTrue(result["changed"])
        self.assertEqual(state["attributes"], first)

        state["guild_id"] = "barbarian"
        result = reroll_attributes(state, seed="again")
        self.assertFalse(result["changed"])
