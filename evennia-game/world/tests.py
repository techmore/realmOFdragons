"""
Evennia migration smoke/unit tests for clean-room DR systems.
"""

from django.test import SimpleTestCase, TestCase
from evennia.utils.create import create_account, create_object, create_script

from commands.dr_commands import ACCOUNT_HELP_TEXT, account_roster_text
from world.dr_data import GUILDS, RACES, RACE_STARTING_ATTRIBUTES, SKILLSETS, build_starter_skills
from world.dr_combat import ENEMIES, appraise_enemy, bash, combat_pressure_scripts, combat_status, corpse_objects, jab, recovery_scripts, respawn_room_enemies, room_enemy_ids, scan_room
from world.dr_economy import ITEMS, SHOPS, buy_item, format_shop, sell_item, shop_talk
from world.dr_guilds import join_guild
from world.dr_identity import choose_race, normalize_race_token, reroll_attributes, roll_race_attributes
from world.dr_progression import advance_circle, circle_status, guild_ability_summary, guild_circle_perk, primary_skill_for_guild, resolve_skill_id, train_skill, unlocked_guild_perks
from world.dr_world import DIRECTION_ALIASES, ROOMS, START_ROOM_ID, build_crossing_world, find_built_room, find_path, guild_registrar_rooms, validate_world_graph


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
        roster_text = account_roster_text(account)
        self.assertIn("Use `puppet <name>` to enter Crossing.", roster_text)
        self.assertIn("Aela: Elf, Unaffiliated, Circle 1", roster_text)
        self.assertIn(f"({START_ROOM_ID})", roster_text)
        self.assertIn("join guild", roster_text)
        account.execute_cmd("characters")
        account.execute_cmd("roster")
        account.execute_cmd("account help")
        account.execute_cmd("drhelp")

    def test_account_create_character_supports_all_races_as_circle_one_commoners(self):
        account = create_account("AllRaceCreationAccount", None, "test-password")
        names = (
            "Race Smoke Ada",
            "Race Smoke Bera",
            "Race Smoke Cora",
            "Race Smoke Dara",
            "Race Smoke Elda",
            "Race Smoke Fara",
            "Race Smoke Gala",
            "Race Smoke Hara",
            "Race Smoke Ilya",
            "Race Smoke Jora",
            "Race Smoke Kara",
        )
        for character_name, (race_id, race_name) in zip(names, RACES.items()):
            account.execute_cmd(f"create character {character_name} = {race_name}")
            character = next(
                character
                for character in account.characters.all()
                if character.key == character_name
            )
            self.assertEqual(character.db.race, race_id)
            self.assertEqual(character.db.race_name, race_name)
            self.assertEqual(character.db.attributes, RACE_STARTING_ATTRIBUTES[race_id])
            self.assertTrue(character.db.creation_complete)
            self.assertEqual(character.db.guild_id, "commoner")
            self.assertEqual(character.db.guild_name, "Unaffiliated")
            self.assertEqual(character.db.circle, 1)
            self.assertEqual(character.location.db.dr_room_id, START_ROOM_ID)
        self.assertEqual(len(list(account.characters.all())), len(RACES))

    def test_account_help_and_empty_roster_explain_creation_and_puppeting(self):
        account = create_account("EmptyRosterAccount", None, "test-password")
        empty_roster_text = account_roster_text(account)
        self.assertIn("create character <name> = <race name>", empty_roster_text)
        self.assertIn("Guilds are joined in-world", empty_roster_text)
        self.assertIn("puppet <name>", ACCOUNT_HELP_TEXT)
        self.assertIn("do not choose a guild at account creation", ACCOUNT_HELP_TEXT)

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

    def test_account_create_character_rejects_invalid_names(self):
        account = create_account("InvalidNameAccount", None, "test-password")
        account.execute_cmd("create character Al = elf")
        account.execute_cmd("create character 9Aela = elf")
        account.execute_cmd("create character Aela! = elf")
        self.assertEqual(list(account.characters.all()), [])


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

    def test_built_crossing_exits_have_mud_direction_aliases(self):
        build_crossing_world()
        for room_id, data in ROOMS.items():
            room = find_built_room(room_id)
            for direction in data.get("exits", {}):
                expected_alias = DIRECTION_ALIASES[direction]
                exit_obj = next(
                    candidate for candidate in room.exits if candidate.key == direction
                )
                self.assertIn(expected_alias, exit_obj.aliases.all())

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
            self.assertEqual(room.db.shop_stock, tuple(shop["stock"]))
            self.assertEqual(room.db.shop_last_refresh, "builder")

    def test_build_crossing_world_preserves_mutated_shop_stock(self):
        build_crossing_world()
        room = find_built_room(START_ROOM_ID)
        room.db.shop_stock = ("travel_rations",)
        room.db.shop_last_refresh = "manual"
        build_crossing_world()
        self.assertEqual(room.db.shop_stock, ("travel_rations",))
        self.assertEqual(room.db.shop_last_refresh, "manual")

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

    def test_direction_alias_commands_move_through_crossing(self):
        character = self.make_character("Direction Alias Smoke")
        character.execute_cmd("s")
        self.assertEqual(character.location.db.dr_room_id, "crossing-RV01-001")
        character.execute_cmd("n")
        self.assertEqual(character.location.db.dr_room_id, START_ROOM_ID)
        character.execute_cmd("ne")
        self.assertEqual(character.location.db.dr_room_id, "crossing-GU01-001")
        character.execute_cmd("sw")
        self.assertEqual(character.location.db.dr_room_id, START_ROOM_ID)

    def test_command_exits_can_walk_to_every_crossing_room(self):
        character = self.make_character("Full Crossing Walk Smoke")
        start = find_built_room(START_ROOM_ID)
        for destination_room_id in ROOMS:
            character.move_to(start, quiet=True)
            for direction in find_path(START_ROOM_ID, destination_room_id):
                character.execute_cmd(direction)
            self.assertEqual(
                character.location.db.dr_room_id,
                destination_room_id,
                f"Expected command movement to reach {destination_room_id}",
            )

    def test_room_status_commands_describe_text_navigation_context(self):
        character = self.make_character("Room Status Smoke")
        character.execute_cmd("room")
        character.execute_cmd("exits")
        character.execute_cmd("where")
        self.assertEqual(character.location.db.dr_room_id, START_ROOM_ID)
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("room")
        character.execute_cmd("scan")
        self.assertEqual(character.location.db.targets, ("rv-wolf-cub",))

    def test_focused_text_help_topics_cover_movement_and_combat(self):
        character = self.make_character("Focused Help Smoke")
        character.execute_cmd("drhelp")
        character.execute_cmd("help progression")
        character.execute_cmd("help room")
        character.execute_cmd("help scan")
        character.execute_cmd("help targets")
        character.execute_cmd("help target")
        character.execute_cmd("help combat")
        character.execute_cmd("help unknown-topic")

    def prepare_circle_two_requirements(self, character):
        primary = primary_skill_for_guild(character.db.guild_id)
        character.db.skills[primary]["rank"] = 4
        character.db.skills["athletics"]["rank"] = 2

    def test_join_guild_requires_a_registrar_room_command(self):
        character = self.make_character("Registrar Gate Smoke")
        character.execute_cmd("drhelp")
        character.execute_cmd("commands")
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
            status_text = "\n".join(
                circle_status(
                    {
                        "guild_id": character.db.guild_id,
                        "guild_name": character.db.guild_name,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn(f"Registrar: {registrars[guild_id]}.", status_text)
            self.assertIn("Next step: train", status_text)
            self.assertEqual(character.db.circle, 1)

            self.train_and_circle_to(character, 10)
            self.assertEqual(len(character.db.guild_perks), 10)
            self.assertEqual(character.db.guild_perks[-1], guild_circle_perk(guild_id, 10))
            character.execute_cmd("perks")
            character.execute_cmd("abilities")
            character.execute_cmd("guild abilities")
            ability_text = "\n".join(guild_ability_summary(guild_id, character.db.circle))
            self.assertIn(f"{guild_name} abilities through Circle 10:", ability_text)
            self.assertIn("Circle 10 is the current supported ability cap.", ability_text)
            self.assertEqual(ability_text.count("- Circle "), 10)
            character.execute_cmd("circle")
            capped_status_text = "\n".join(
                circle_status(
                    {
                        "guild_id": character.db.guild_id,
                        "guild_name": character.db.guild_name,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn("Circle 10 is the current supported cap", capped_status_text)
            self.assertIn("Next step: continue training skills", capped_status_text)
            self.assertEqual(character.db.circle, 10)

    def test_circle_status_guides_unaffiliated_and_ready_characters(self):
        character = self.make_character("Circle Guidance Smoke")
        unaffiliated_status = "\n".join(
            circle_status(
                {
                    "guild_id": character.db.guild_id,
                    "guild_name": character.db.guild_name,
                    "circle": character.db.circle,
                    "skills": character.db.skills,
                    "room_guild_id": character.location.db.guild,
                }
            )
        )
        self.assertIn("join guild", unaffiliated_status)

        self.walk_to_room(character, guild_registrar_rooms()["barbarian"])
        character.execute_cmd("join guild")
        self.prepare_circle_two_requirements(character)
        ready_status = "\n".join(
            circle_status(
                {
                    "guild_id": character.db.guild_id,
                    "guild_name": character.db.guild_name,
                    "circle": character.db.circle,
                    "skills": character.db.skills,
                    "room_guild_id": character.location.db.guild,
                }
            )
        )
        self.assertIn("Next step: use `circle` to advance.", ready_status)

    def test_joined_characters_cannot_switch_guilds_at_other_registrars(self):
        registrars = guild_registrar_rooms()
        for first_guild_id, first_guild_name in GUILDS.items():
            second_guild_id = next(
                guild_id for guild_id in GUILDS if guild_id != first_guild_id
            )
            character = self.make_character(f"{first_guild_name} Switch Smoke")
            self.walk_to_room(character, registrars[first_guild_id])
            character.execute_cmd("join guild")
            self.assertEqual(character.db.guild_id, first_guild_id)
            self.assertEqual(character.db.guild_name, first_guild_name)

            self.walk_to_room(character, registrars[second_guild_id])
            character.execute_cmd("join guild")
            self.assertEqual(character.db.guild_id, first_guild_id)
            self.assertEqual(character.db.guild_name, first_guild_name)
            self.assertEqual(character.db.guild_perks, [guild_circle_perk(first_guild_id, 1)])

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

        shop_text = format_shop(character.location)
        self.assertIn("Accepted stock: torch, travel_rations.", shop_text)
        self.assertIn("buy <item>", shop_text)
        self.assertIn("sell <item>", shop_text)
        self.assertIn("Marta trades: torch, travel_rations.", shop_talk(character.location))
        self.assertIn("Available stock: torch, travel_rations.", buy_item(character, ""))
        self.assertIn("I do not have small_blade for sale", buy_item(character, "small_blade"))
        character.execute_cmd("shop")
        character.execute_cmd("shop talk")
        character.execute_cmd("shop stock")
        character.execute_cmd("shop refresh")
        self.assertEqual(character.location.db.shop_stock, ("torch", "travel_rations"))
        character.execute_cmd("shop stock")
        character.execute_cmd("buy torch")
        self.assertEqual(character.location.db.shop_stock, ("travel_rations",))
        character.execute_cmd("buy torch")
        self.assertEqual(character.db.inventory.count("torch"), 1)
        character.execute_cmd("shop refresh")
        self.assertEqual(character.location.db.shop_stock, ("torch", "travel_rations"))
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
        self.assertEqual(character.location.db.shop_stock, ("torch", "travel_rations"))
        self.assertFalse(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "torch"
            ]
        )
        self.assertEqual(character.db.wallet["trias"], 97)

    def test_shopkeepers_reject_untraded_items_and_missing_carried_items(self):
        character = self.make_character("Shop Refusal Smoke")
        self.walk_to_room(character, "crossing-RV02-002")
        self.assertIn(
            "I do not trade in torch",
            sell_item(character, "torch"),
        )
        character.execute_cmd("buy small_blade")
        character.execute_cmd("sell small_blade")
        self.assertIn(
            "You are not carrying Small Practice Blade",
            sell_item(character, "small_blade"),
        )

    def test_all_configured_shops_support_dialogue_buy_sell_and_refresh(self):
        for room_id, shop in SHOPS.items():
            character = self.make_character(f"{shop['keeper']} Shop Loop Smoke")
            character.db.wallet = {"plat": 0, "trias": 500, "lucan": 0, "silk": 0}
            self.walk_to_room(character, room_id)

            shop_text = format_shop(character.location)
            self.assertIn(shop["name"], shop_text)
            self.assertIn(shop["keeper"], shop_text)
            self.assertIn("buy <item>", shop_text)
            self.assertIn("sell <item>", shop_text)
            talk_text = shop_talk(character.location)
            self.assertIn(shop["dialogue"], talk_text)
            self.assertIn("trades:", talk_text)
            character.execute_cmd("shop")
            character.execute_cmd("shop talk")
            character.execute_cmd("shop stock")

            for item_id in shop["stock"]:
                character.execute_cmd("shop refresh")
                self.assertEqual(character.location.db.shop_stock, tuple(shop["stock"]))
                before_wallet = character.db.wallet["trias"]
                character.execute_cmd(f"buy {item_id}")
                self.assertLess(character.db.wallet["trias"], before_wallet)
                self.assertNotIn(item_id, character.location.db.shop_stock)
                self.assertTrue(
                    [
                        obj
                        for obj in character.contents
                        if obj.db.object_type == "item" and obj.db.item_id == item_id
                    ]
                )

                character.execute_cmd(f"sell {item_id}")
                self.assertIn(item_id, character.location.db.shop_stock)
                self.assertFalse(
                    [
                        obj
                        for obj in character.contents
                        if obj.db.object_type == "item" and obj.db.item_id == item_id
                    ]
                )

            character.execute_cmd("shop refresh")
            self.assertEqual(character.location.db.shop_stock, tuple(shop["stock"]))

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

        scan_text = scan_room(character.location)
        self.assertIn("fair difficulty", scan_text)
        self.assertIn("Suggested next command", scan_text)
        character.execute_cmd("scan")
        appraise_text = appraise_enemy(character, "rv-wolf-cub")
        self.assertIn("Difficulty: fair.", appraise_text)
        self.assertIn("Suggested next command: target rv-wolf-cub.", appraise_text)
        character.execute_cmd("appraise rv-wolf-cub")
        character.execute_cmd("target rv-wolf-cub")
        self.assertEqual(character.db.engagement["target"], "rv-wolf-cub")
        self.assertEqual(character.db.engagement["range"], "missile")
        self.assertEqual(len(combat_pressure_scripts(character)), 1)
        self.assertIn("Suggested next command: advance.", combat_status(character))

        character.execute_cmd("appraise target")
        character.execute_cmd("combat")
        character.execute_cmd("range")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "pole")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "melee")
        self.assertIn("Suggested next command: jab or bash.", combat_status(character))
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["range"], "pole")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["range"], "missile")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(len(combat_pressure_scripts(character)), 0)
        character.execute_cmd("combat")

    def test_all_crossing_enemies_can_be_fought_through_command_loop(self):
        for room_id, data in ROOMS.items():
            for enemy_id in data.get("targets", ()):
                character = self.make_character(f"{ENEMIES[enemy_id]['name']} Loop Smoke")
                character.db.health = 50
                character.db.max_health = 50
                self.walk_to_room(character, room_id)

                scan_text = scan_room(character.location)
                self.assertIn(enemy_id, scan_text)
                character.execute_cmd("scan")
                character.execute_cmd(f"target {enemy_id}")
                self.assertEqual(character.db.engagement["target"], enemy_id)
                self.assertEqual(character.db.engagement["range"], "missile")
                self.assertEqual(len(combat_pressure_scripts(character)), 1)
                character.execute_cmd("advance")
                character.execute_cmd("advance")
                self.assertEqual(character.db.engagement["range"], "melee")

                attempts = 0
                while enemy_id in room_enemy_ids(character.location) and attempts < 10:
                    attempts += 1
                    character.execute_cmd("bash")
                    character.execute_cmd("wait")
                    character.execute_cmd("wait")

                self.assertNotIn(enemy_id, room_enemy_ids(character.location))
                self.assertEqual(character.db.engagement["target"], None)
                self.assertEqual(len(combat_pressure_scripts(character)), 0)
                self.assertEqual(len(corpse_objects(character.location)), 1)
                self.assertGreater(character.db.skills["brawling"]["pool"], 0)
                self.assertGreater(character.db.skills["tactics"]["pool"], 0)

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
        jab_text = jab(character)
        self.assertIn("Combat state:", jab_text)
        self.assertIn("Roundtime: 1", jab_text)
        self.assertIn("Enemy vitality: 8/14.", jab_text)
        self.assertIn("Suggested next command: wait.", jab_text)
        self.assertEqual(character.db.balance, "recovering")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.health, 27)
        self.assertEqual(len(recovery_scripts(character)), 1)
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
        bash_text = bash(character)
        self.assertIn("collapses", bash_text)
        self.assertIn("Suggested next command: loot corpse.", bash_text)
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
        recovery_script = create_script("typeclasses.scripts.RecoveryScript", obj=character, start_delay=True)
        recovery_script.at_repeat()
        self.assertEqual(character.db.roundtime, 0)
        self.assertEqual(character.db.balance, "balanced")
        self.assertFalse(recovery_script.pk)

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

    def test_enemy_pressure_incapacitation_and_revive(self):
        character = self.make_character("Incapacitation Smoke")
        character.db.health = 1
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("target rv-wolf-cub")
        character.execute_cmd("advance")
        pressure_script = combat_pressure_scripts(character)[0]
        pressure_script.at_repeat()
        self.assertEqual(character.db.health, 0)
        self.assertTrue(character.db.incapacitated)
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(len(combat_pressure_scripts(character)), 0)
        character.execute_cmd("target rv-wolf-cub")
        self.assertEqual(character.db.engagement["target"], None)
        character.execute_cmd("revive")
        self.assertFalse(character.db.incapacitated)
        self.assertEqual(character.db.health, 15)
        character.execute_cmd("stand")

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
        self.assertEqual(len(recovery_scripts(character)), 1)

    def test_combat_maneuvers_deduplicate_recovery_scripts(self):
        character = self.make_character("Recovery Dedup Smoke")
        self.walk_to_room(character, "crossing-RV02-003")
        character.execute_cmd("target rv-boarlet")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        character.execute_cmd("jab")
        self.assertEqual(len(recovery_scripts(character)), 1)
        recovery_script = recovery_scripts(character)[0]
        recovery_script.at_repeat()
        self.assertEqual(character.db.roundtime, 0)
        self.assertEqual(character.db.balance, "balanced")
        self.assertEqual(len(recovery_scripts(character)), 0)
        character.execute_cmd("target rv-boarlet")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        character.execute_cmd("defend")
        character.execute_cmd("bash")
        self.assertEqual(len(recovery_scripts(character)), 1)

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
