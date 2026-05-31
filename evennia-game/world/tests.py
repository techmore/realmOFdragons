"""
Evennia migration smoke/unit tests for clean-room DR systems.
"""

from django.test import SimpleTestCase, TestCase
from evennia.accounts.models import AccountDB
from evennia.objects.models import ObjectDB
from evennia.utils.create import create_account, create_object, create_script

from commands.dr_commands import ACCOUNT_HELP_TEXT, CHARACTER_HELP_TEXT, CHARACTER_HELP_TOPICS, account_roster_text, journey_summary
from world.dr_data import GUILDS, RACES, RACE_STARTING_ATTRIBUTES, SKILLSETS, build_starter_skills
from world.dr_combat import ENEMIES, aim, appraise_enemy, apply_enemy_pressure, bash, bleeding_scripts, block, combat_pressure_scripts, combat_status, corpse_objects, dodge, feint, health_text, hurl, jab, maneuver_guide, parry, recovery_scripts, respawn_room_enemies, rest, room_enemy_ids, scan_room, skin_corpse
from world.dr_economy import FORAGE_ROOMS, ITEMS, SHOP_TASKS, SHOPS, appraise_item, buy_item, complete_shop_task, drop_item, forage_room, format_shop, remove_item, repair_item, request_shop_task, sell_item, shop_talk, talk_shopkeeper, task_status, use_item, wallet_text
from world.dr_guilds import join_guild, registrar_text
from world.dr_identity import choose_race, normalize_race_token, reroll_attributes, roll_race_attributes
from world.dr_progression import GUILD_BOONS, GUILD_CAPSTONES, GUILD_CIRCLE_PERK_NAMES, GUILD_DRILLS, GUILD_MENTORS, GUILD_PASSIVES, GUILD_RITES, GUILD_SIGNATURES, GUILD_TECHNIQUES, STUDY_ROOMS, advance_circle, circle_status, experience_summary, guild_ability_summary, guild_circle_perk, guild_history_summary, guild_path_summary, guild_plan_summary, guild_title, guild_title_ladder, milestone_skill_for_guild_circle, primary_skill_for_guild, resolve_skill_id, study_room, train_skill, unlocked_guild_perks, use_guild_boon, use_guild_drill, use_guild_focus, use_guild_mentor, use_guild_milestone, use_guild_passive, use_guild_perk, use_guild_practice, use_guild_signature, use_guild_technique
from world.dr_world import DIRECTION_ALIASES, ROOMS, START_ROOM_ID, build_crossing_world, find_built_room, find_path, forage_guide, guild_guide, guild_registrar_rooms, hunting_guide, shop_guide, survey_room, task_guide, travel_guide, validate_world_graph


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
        self.assertIn("puppet, use `survey`, then walk to a registrar and `join guild`", roster_text)
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

    def test_account_created_character_persists_core_start_state_after_reload(self):
        account = create_account("PersistenceAccount", None, "test-password")
        account.execute_cmd("create character Persist Aela = elf")
        character = next(character for character in account.characters.all() if character.key == "Persist Aela")
        character_id = character.id

        reloaded = ObjectDB.objects.get(id=character_id)
        self.assertEqual(reloaded.key, "Persist Aela")
        self.assertEqual(reloaded.db.race, "elf")
        self.assertEqual(reloaded.db.race_name, "Elf")
        self.assertEqual(reloaded.db.attributes, RACE_STARTING_ATTRIBUTES["elf"])
        self.assertTrue(reloaded.db.creation_complete)
        self.assertEqual(reloaded.db.guild_id, "commoner")
        self.assertEqual(reloaded.db.guild_name, "Unaffiliated")
        self.assertEqual(reloaded.db.circle, 1)
        self.assertEqual(reloaded.location.db.dr_room_id, START_ROOM_ID)
        self.assertIn(reloaded, list(account.characters.all()))
        self.assertIn("Persist Aela: Elf, Unaffiliated, Circle 1", account_roster_text(account))
        reloaded_account = AccountDB.objects.get(id=account.id)
        self.assertIn(reloaded, list(reloaded_account.characters.all()))
        self.assertIn("Persist Aela: Elf, Unaffiliated, Circle 1", account_roster_text(reloaded_account))
        self.assertIn("athletics", reloaded.db.skills)
        self.assertEqual(reloaded.db.wallet["trias"], 100)

    def test_joined_character_progression_persists_after_reload(self):
        account = create_account("ProgressionPersistenceAccount", None, "test-password")
        account.execute_cmd("create character Persist Brin = human")
        character = next(character for character in account.characters.all() if character.key == "Persist Brin")
        registrar = find_built_room(guild_registrar_rooms()["barbarian"])
        character.move_to(registrar, quiet=True)
        character.execute_cmd("join guild")
        for _ in range(30):
            character.execute_cmd("train")
        character.execute_cmd("circle")
        self.assertEqual(character.db.guild_id, "barbarian")
        self.assertEqual(character.db.circle, 2)

        reloaded = ObjectDB.objects.get(id=character.id)
        self.assertEqual(reloaded.db.guild_id, "barbarian")
        self.assertEqual(reloaded.db.guild_name, GUILDS["barbarian"])
        self.assertEqual(reloaded.db.circle, 2)
        self.assertEqual(reloaded.location.db.dr_room_id, guild_registrar_rooms()["barbarian"])
        self.assertEqual(reloaded.db.guild_perks, unlocked_guild_perks("barbarian", 2))
        self.assertGreaterEqual(reloaded.db.skills["expertise"]["rank"], 4)
        self.assertIn("Persist Brin: Human, Barbarian Guild, Circle 2", account_roster_text(account))
        self.assertIn("return to your guild registrar, then `train` and `circle`", account_roster_text(account))
        reloaded_account = AccountDB.objects.get(id=account.id)
        self.assertIn(reloaded, list(reloaded_account.characters.all()))
        self.assertIn("Persist Brin: Human, Barbarian Guild, Circle 2", account_roster_text(reloaded_account))
        self.assertIn("return to your guild registrar, then `train` and `circle`", account_roster_text(reloaded_account))

    def test_account_roster_guides_circle_ten_rewards(self):
        account = create_account("RosterGuidanceAccount", None, "test-password")
        account.execute_cmd("create character Reward Brin = human")
        character = next(character for character in account.characters.all() if character.key == "Reward Brin")
        character.db.guild_id = "barbarian"
        character.db.guild_name = GUILDS["barbarian"]
        character.db.circle = 10
        character.db.guild_boons = []
        character.db.guild_capstones = []
        boon_roster = account_roster_text(account)
        self.assertIn("claim `boon`", boon_roster)
        character.db.guild_boons = ["barbarian:10"]
        capstone_roster = account_roster_text(account)
        self.assertIn("claim `capstone`", capstone_roster)
        character.db.guild_capstones = ["barbarian:10"]
        complete_roster = account_roster_text(account)
        self.assertIn("continue training, shops, survey, or hunting", complete_roster)


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

    def test_all_guilds_have_named_circle_one_to_ten_milestones(self):
        self.assertEqual(set(GUILD_CIRCLE_PERK_NAMES), set(GUILDS))
        self.assertEqual(set(GUILD_SIGNATURES), set(GUILDS))
        self.assertEqual(set(GUILD_MENTORS), set(GUILDS))
        for guild_id, perk_names in GUILD_CIRCLE_PERK_NAMES.items():
            self.assertEqual(len(perk_names), 10)
            self.assertEqual(len(set(perk_names)), 10)
            self.assertIn(GUILD_SIGNATURES[guild_id]["skill"], build_starter_skills())
            self.assertTrue(GUILD_SIGNATURES[guild_id]["name"])
            self.assertTrue(GUILD_SIGNATURES[guild_id]["text"])
            self.assertIn(GUILD_MENTORS[guild_id]["skill"], build_starter_skills())
            self.assertTrue(GUILD_MENTORS[guild_id]["name"])
            self.assertTrue(GUILD_MENTORS[guild_id]["advice"])
            unlocked = unlocked_guild_perks(guild_id, 10)
            self.assertEqual(len(unlocked), 10)
            self.assertNotIn("recognition", " ".join(unlocked).lower())
            self.assertIn(perk_names[0], guild_circle_perk(guild_id, 1))
            self.assertIn(perk_names[-1], guild_circle_perk(guild_id, 10))
            self.assertEqual(milestone_skill_for_guild_circle(guild_id, 1), primary_skill_for_guild(guild_id))
            self.assertEqual(milestone_skill_for_guild_circle(guild_id, 2), GUILD_TECHNIQUES[guild_id]["skill"])
            self.assertEqual(milestone_skill_for_guild_circle(guild_id, 3), GUILD_PASSIVES[guild_id]["skill"])
            self.assertEqual(milestone_skill_for_guild_circle(guild_id, 4), GUILD_DRILLS[guild_id]["skill"])
            self.assertEqual(milestone_skill_for_guild_circle(guild_id, 5), GUILD_RITES[guild_id]["skill"])
            self.assertEqual(milestone_skill_for_guild_circle(guild_id, 10), GUILD_CAPSTONES[guild_id]["skill"])


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
        self.assertTrue(find_path(START_ROOM_ID, "crossing-RV02-006"))
        self.assertTrue(find_path(START_ROOM_ID, "crossing-RV02-008"))
        self.assertTrue(find_path(START_ROOM_ID, "crossing-RV02-013"))
        self.assertTrue(find_path(START_ROOM_ID, "crossing-RV02-014"))
        self.assertTrue(find_path(START_ROOM_ID, "crossing-RV02-015"))
        self.assertTrue(find_path(START_ROOM_ID, "crossing-RV02-016"))
        self.assertEqual(find_path(START_ROOM_ID, "crossing-RV02-009"), ["south", "south", "west"])

    def test_task_guide_lists_routes_rewards_and_destinations(self):
        town_guide = task_guide(None)
        self.assertIn("Crossing shop tasks:", town_guide)
        self.assertIn("South road supply note from Town Green Provisioner", town_guide)
        self.assertIn("reward 9 trias; here; deliver to Culvert Cache", town_guide)
        self.assertIn("Towpath wrap bundle from Towpath Supply Shelf", town_guide)
        self.assertIn("Suggested loop: travel to a task shop, survey, task request", town_guide)

    def test_travel_guide_lists_every_room_with_routes_and_markers(self):
        town_guide = travel_guide(None)
        self.assertIn("Crossing travel routes:", town_guide)
        self.assertEqual(town_guide.count("- "), len(ROOMS))
        self.assertIn("Crossing Town Green (crossing-TG01-001): here.", town_guide)
        self.assertIn("Mossy Spillway Steps (crossing-RV02-013): go south, south, east, east, east, east, east, south, east, east.", town_guide)
        self.assertIn("enemies: rv-spillway-eel", town_guide)
        self.assertIn("Weir Watch Platform (crossing-RV02-014): go south, south, east, east, east, east, east, south, east, east, east.", town_guide)
        self.assertIn("enemies: rv-weir-otter", town_guide)
        self.assertIn("Canal Bank Narrows (crossing-RV02-015): go south, south, east, east, east, east, east, south, east, east, east, east.", town_guide)
        self.assertIn("enemies: rv-bank-mink", town_guide)
        self.assertIn("Reed Bank Blind (crossing-RV02-016): go south, south, east, east, east, east, east, south, east, east, east, east, east.", town_guide)
        self.assertIn("enemies: rv-reed-heron", town_guide)
        self.assertIn("guild: Barbarian Guild", town_guide)
        self.assertIn("shop: Spillway Rope Hook", town_guide)
        self.assertIn("task: Spillway rope count", town_guide)
        self.assertIn("shop: Weir Watch Kit", town_guide)
        self.assertIn("task: Weir hook report", town_guide)
        self.assertIn("shop: Canal Bank Supply Tin", town_guide)
        self.assertIn("task: Bank narrows count", town_guide)
        self.assertIn("shop: Reed Blind Tackle Box", town_guide)
        self.assertIn("task: Reed blind tally", town_guide)


class DRWorldBuilderTests(TestCase):
    def test_task_guide_command_lists_local_routes_rewards_and_destinations(self):
        build_crossing_world()
        towpath = find_built_room("crossing-RV02-010")
        local_guide = task_guide(towpath)
        self.assertIn("Towpath wrap bundle from Towpath Supply Shelf", local_guide)
        self.assertIn("reward 7 trias; here; deliver to Canal Edge Pack Stand", local_guide)

        character = create_object("typeclasses.characters.Character", key="Task Guide Smoke", location=towpath, home=towpath)
        character.execute_cmd("tasks")
        character.execute_cmd("task guide")
        character.execute_cmd("jobs")
        character.execute_cmd("job guide")

    def test_travel_guide_command_lists_local_route_context(self):
        build_crossing_world()
        spillway = find_built_room("crossing-RV02-013")
        local_guide = travel_guide(spillway)
        self.assertIn("Mossy Spillway Steps (crossing-RV02-013): here.", local_guide)
        self.assertIn("Canal Sluice Yard (crossing-RV02-012): go west.", local_guide)
        self.assertIn("Crossing Town Green", local_guide)

        character = create_object("typeclasses.characters.Character", key="Route Guide Smoke", location=spillway, home=spillway)
        character.execute_cmd("routes")
        character.execute_cmd("travel guide")
        character.execute_cmd("map")

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
        drainage = find_built_room("crossing-RV02-006")
        self.assertEqual(drainage.db.targets, ("rv-ditch-rat",))
        canal_edge = find_built_room("crossing-RV02-008")
        self.assertEqual(canal_edge.db.targets, ("rv-marsh-spider",))
        orchard = find_built_room("crossing-RV02-009")
        self.assertEqual(orchard.db.targets, ("rv-orchard-crow",))
        lockworks = find_built_room("crossing-RV02-011")
        self.assertEqual(lockworks.db.targets, ("rv-lockwork-crab",))
        sluice = find_built_room("crossing-RV02-012")
        self.assertEqual(sluice.db.targets, ("rv-sluice-rat",))
        spillway = find_built_room("crossing-RV02-013")
        self.assertEqual(spillway.db.targets, ("rv-spillway-eel",))
        weir = find_built_room("crossing-RV02-014")
        self.assertEqual(weir.db.targets, ("rv-weir-otter",))
        bank = find_built_room("crossing-RV02-015")
        self.assertEqual(bank.db.targets, ("rv-bank-mink",))
        blind = find_built_room("crossing-RV02-016")
        self.assertEqual(blind.db.targets, ("rv-reed-heron",))

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

    def test_journey_summary_guides_current_next_steps(self):
        character = self.make_character("Journey Smoke")
        town_summary = journey_summary(character)
        self.assertIn("Journey:", town_summary)
        self.assertIn("Location: Crossing Town Green", town_summary)
        self.assertIn("Task: none", town_summary)
        self.assertIn("Guild: unaffiliated", town_summary)
        self.assertIn("Combat: no active target", town_summary)
        character.execute_cmd("journey")
        character.execute_cmd("next steps")

        request_shop_task(character)
        task_summary = journey_summary(character)
        self.assertIn("South road supply note", task_summary)
        self.assertIn("Culvert Cache", task_summary)
        self.assertIn("go south, south, east, east, east", task_summary)
        character.execute_cmd("todo")

        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("target rv-wolf-cub")
        combat_summary = journey_summary(character)
        self.assertIn("Combat: engaged with rv-wolf-cub at missile", combat_summary)
        character.execute_cmd("status")

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
        character.execute_cmd("survey")
        self.assertEqual(character.location.db.dr_room_id, START_ROOM_ID)
        town_survey = survey_room(character.location, character)
        self.assertIn("Survey: Crossing Town Green", town_survey)
        self.assertIn("Shop: Town Green Provisioner", town_survey)
        self.assertIn("Shop task: South road supply note", town_survey)
        town_hunting = hunting_guide(character.location)
        self.assertIn("Crossing hunting grounds:", town_hunting)
        self.assertIn("Brushline Forage Fork", town_hunting)
        self.assertIn("go south, south, east", town_hunting)
        self.assertIn("rv-sluice-rat", town_hunting)
        self.assertIn("rv-weir-otter", town_hunting)
        self.assertIn("rv-bank-mink", town_hunting)
        self.assertIn("rv-reed-heron", town_hunting)
        self.assertIn("rv-causeway-turtle", town_hunting)
        character.execute_cmd("hunting")
        town_shops = shop_guide(character.location)
        self.assertIn("Crossing shops and tasks:", town_shops)
        self.assertIn("Town Green Provisioner", town_shops)
        self.assertIn("here; task: South road supply note", town_shops)
        self.assertIn("Sluice Yard Crate", town_shops)
        self.assertIn("field_bandage, torch, travel_rations", town_shops)
        self.assertIn("Weir Watch Kit", town_shops)
        self.assertIn("Canal Bank Supply Tin", town_shops)
        self.assertIn("Reed Blind Tackle Box", town_shops)
        self.assertIn("Causeway Reed Pack", town_shops)
        character.execute_cmd("shops")
        town_guilds = guild_guide(character.location)
        self.assertIn("Crossing guild registrars:", town_guilds)
        self.assertIn("Barbarian Guild", town_guilds)
        self.assertIn("primary Expertise", town_guilds)
        self.assertIn("go south, east", town_guilds)
        self.assertIn("Warrior Mage Guild", town_guilds)
        character.execute_cmd("guilds")
        town_forage = forage_guide(character.location)
        self.assertIn("Crossing forage sites:", town_forage)
        self.assertIn("South Gate Trailhead", town_forage)
        self.assertIn("wild_herbs; go south, south", town_forage)
        self.assertIn("Sluice Yard", town_forage)
        self.assertIn("Weir Watch Platform", town_forage)
        self.assertIn("Canal Bank Narrows", town_forage)
        self.assertIn("Reed Bank Blind", town_forage)
        self.assertIn("Fallen Reed Causeway", town_forage)
        self.assertIn("Suggested loop: travel, survey, forage", town_forage)
        character.execute_cmd("forage guide")
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("room")
        character.execute_cmd("search room")
        character.execute_cmd("scan")
        hunting_survey = survey_room(character.location, character)
        self.assertIn("Forage: wild_herbs", hunting_survey)
        self.assertIn("Enemies: rv-wolf-cub", hunting_survey)
        self.assertIn("Shop: Riverside Field Outfitter", hunting_survey)
        self.assertEqual(character.location.db.targets, ("rv-wolf-cub",))
        local_hunting = hunting_guide(character.location)
        self.assertIn("Brushline Forage Fork", local_hunting)
        self.assertIn("here", local_hunting)
        self.assertIn("Suggested loop: travel, survey, scan", local_hunting)
        character.execute_cmd("hunt")
        local_shops = shop_guide(character.location)
        self.assertIn("Riverside Field Outfitter", local_shops)
        self.assertIn("here.", local_shops)
        self.assertIn("Suggested loop: travel, survey, shop", local_shops)
        character.execute_cmd("stores")
        local_forage = forage_guide(character.location)
        self.assertIn("Brushline Forage Fork", local_forage)
        self.assertIn("here", local_forage)
        self.assertIn("appraise wild_herbs", local_forage)
        character.execute_cmd("gather guide")
        self.walk_to_room(character, "crossing-GU10-001")
        registrar_survey = survey_room(character.location, character)
        self.assertIn("Guild registrar: Barbarian Guild", registrar_survey)
        self.assertIn("Commands: registrar, join guild, train, circle", registrar_survey)
        registrar_guilds = guild_guide(character.location)
        self.assertIn("Barbarian Guild", registrar_guilds)
        self.assertIn("here", registrar_guilds)
        self.assertIn("Suggested loop: travel to a registrar", registrar_guilds)
        character.execute_cmd("registrars")

    def test_focused_text_help_topics_cover_movement_and_combat(self):
        character = self.make_character("Focused Help Smoke")
        self.assertIn("registrar", CHARACTER_HELP_TEXT)
        self.assertIn("survey", CHARACTER_HELP_TEXT)
        self.assertIn("signature", CHARACTER_HELP_TEXT)
        self.assertIn("mentor", CHARACTER_HELP_TEXT)
        self.assertIn("guild plan", CHARACTER_HELP_TEXT)
        self.assertIn("focus", CHARACTER_HELP_TEXT)
        self.assertIn("technique", CHARACTER_HELP_TEXT)
        self.assertIn("use registrar for guidance", CHARACTER_HELP_TOPICS["progression"])
        self.assertIn("signature", CHARACTER_HELP_TOPICS["progression"])
        self.assertIn("mentor", CHARACTER_HELP_TOPICS["progression"])
        self.assertIn("guild plan", CHARACTER_HELP_TOPICS["progression"])
        self.assertIn("abilities, focus, and technique", CHARACTER_HELP_TOPICS["progression"])
        self.assertIn("ask stock", CHARACTER_HELP_TEXT)
        self.assertIn("ask task", CHARACTER_HELP_TOPICS["progression"])
        self.assertIn("boon", CHARACTER_HELP_TEXT)
        self.assertIn("rest", CHARACTER_HELP_TEXT)
        self.assertIn("rest - recover roundtime", CHARACTER_HELP_TOPICS["combat"])
        self.assertIn("study", CHARACTER_HELP_TEXT)
        self.assertIn("ask <keeper>", CHARACTER_HELP_TEXT)
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

            pre_join_registrar_text = "\n".join(
                registrar_text(
                    {
                        "guild_id": character.db.guild_id,
                        "guild_name": character.db.guild_name,
                        "circle": character.db.circle,
                    },
                    {"guild": character.location.db.guild},
                )
            )
            self.assertIn(f"{guild_name} registrar:", pre_join_registrar_text)
            self.assertIn("Next commands: join guild", pre_join_registrar_text)
            character.execute_cmd("registrar")
            character.execute_cmd("ask registrar")
            character.execute_cmd("join guild")
            self.assertEqual(character.db.guild_id, guild_id)
            self.assertEqual(character.db.guild_name, guild_name)
            self.assertEqual(character.db.guild_perks, [guild_circle_perk(guild_id, 1)])
            post_join_registrar_text = "\n".join(
                registrar_text(
                    {
                        "guild_id": character.db.guild_id,
                        "guild_name": character.db.guild_name,
                        "circle": character.db.circle,
                    },
                    {"guild": character.location.db.guild},
                )
            )
            self.assertIn("Next commands: train", post_join_registrar_text)
            self.assertIn("passive", post_join_registrar_text)
            self.assertIn("drill", post_join_registrar_text)
            self.assertIn("practice", post_join_registrar_text)
            self.assertIn("rite", post_join_registrar_text)
            self.assertIn("boon", post_join_registrar_text)
            self.assertIn("capstone", post_join_registrar_text)
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
            path_text = "\n".join(
                guild_path_summary(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "guild_boons": character.db.guild_boons or [],
                        "guild_capstones": character.db.guild_capstones or [],
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn("Core loop: train, study, mentor, signature, focus, technique, passive, drill, circle status, circle.", path_text)
            self.assertIn("Circle 5 rite is not open yet", path_text)
            self.assertIn("Available boon", path_text)
            self.assertIn(f"Current title: {guild_title(guild_id, 1)}.", path_text)
            character.execute_cmd("path")
            plan_text = "\n".join(
                guild_plan_summary(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                    }
                )
            )
            self.assertIn(f"{guild_name} Circle plan through Circle 10:", plan_text)
            self.assertIn("Circle ladder:", plan_text)
            self.assertIn("Registrar actions: train, study, perk, milestone, drill, practice, rite, boon, capstone, circle status, circle.", plan_text)
            self.assertEqual(plan_text.count("- Circle "), 10)
            self.assertIn(f"Circle 1: {guild_circle_perk(guild_id, 1)}", plan_text)
            self.assertIn(f"Registrar: {registrars[guild_id]}.", plan_text)
            character.execute_cmd("guild plan")
            character.execute_cmd("circle plan")
            title_text = "\n".join(guild_title_ladder(guild_id, character.db.circle))
            self.assertIn(f"{guild_name} titles through Circle 1:", title_text)
            self.assertIn(f"Circle 1: {guild_title(guild_id, 1)}", title_text)
            character.execute_cmd("title")
            experience_text = "\n".join(
                experience_summary(
                    {
                        "guild_id": character.db.guild_id,
                        "guild_name": character.db.guild_name,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "guild_boons": character.db.guild_boons or [],
                        "guild_capstones": character.db.guild_capstones or [],
                    }
                )
            )
            self.assertIn(f"Experience summary: {guild_name}, Circle 1.", experience_text)
            self.assertIn(f"Title: {guild_title(guild_id, 1)}.", experience_text)
            self.assertIn("Next Circle 2:", experience_text)
            character.execute_cmd("experience")

            self.train_and_circle_to(character, 10)
            self.assertEqual(len(character.db.guild_perks), 10)
            self.assertEqual(character.db.guild_perks[-1], guild_circle_perk(guild_id, 10))
            reloaded_circle_ten = ObjectDB.objects.get(id=character.id)
            self.assertEqual(reloaded_circle_ten.db.guild_id, guild_id)
            self.assertEqual(reloaded_circle_ten.db.guild_name, guild_name)
            self.assertEqual(reloaded_circle_ten.db.circle, 10)
            self.assertEqual(reloaded_circle_ten.db.guild_perks, unlocked_guild_perks(guild_id, 10))
            self.assertEqual(reloaded_circle_ten.location.db.dr_room_id, registrars[guild_id])
            character.execute_cmd("perks")
            character.execute_cmd("abilities")
            character.execute_cmd("guild abilities")
            ability_text = "\n".join(guild_ability_summary(guild_id, character.db.circle))
            self.assertIn(f"{guild_name} abilities through Circle 10:", ability_text)
            self.assertIn("Circle 10 is the current supported ability cap.", ability_text)
            self.assertIn("Registrar boon:", ability_text)
            self.assertIn("Guild signature:", ability_text)
            self.assertIn("Use `signature`", ability_text)
            self.assertIn("Registrar mentor:", ability_text)
            self.assertIn("Use `mentor`", ability_text)
            self.assertIn("Passive training:", ability_text)
            self.assertIn("Registrar drill:", ability_text)
            self.assertIn("Circle rite:", ability_text)
            self.assertIn("Circle 10 capstone:", ability_text)
            self.assertIn(f"Current title: {guild_title(guild_id, 10)}.", ability_text)
            self.assertEqual(ability_text.count("- Circle "), 10)
            circle_ten_title_text = "\n".join(guild_title_ladder(guild_id, character.db.circle))
            self.assertIn(f"{guild_name} titles through Circle 10:", circle_ten_title_text)
            self.assertIn(f"Circle 10: {guild_title(guild_id, 10)}", circle_ten_title_text)
            self.assertIn("current supported title cap", circle_ten_title_text)
            character.execute_cmd("guild title")
            pre_reward_history = "\n".join(
                guild_history_summary(
                    {
                        "guild_id": guild_id,
                        "circle": character.db.circle,
                        "guild_boons": character.db.guild_boons or [],
                        "guild_capstones": character.db.guild_capstones or [],
                    }
                )
            )
            self.assertIn(f"{guild_name} history through Circle 10:", pre_reward_history)
            self.assertIn(guild_circle_perk(guild_id, 10), pre_reward_history)
            self.assertIn(f"Circle 10 boon: {GUILD_BOONS[guild_id]['name']}", pre_reward_history)
            self.assertIn("is unclaimed", pre_reward_history)
            self.assertIn(f"Circle 10 capstone: {GUILD_CAPSTONES[guild_id]['name']}", pre_reward_history)
            character.execute_cmd("guild history")
            character.execute_cmd("renown")
            capped_experience_text = "\n".join(
                experience_summary(
                    {
                        "guild_id": character.db.guild_id,
                        "guild_name": character.db.guild_name,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "guild_boons": character.db.guild_boons or [],
                        "guild_capstones": character.db.guild_capstones or [],
                    }
                )
            )
            self.assertIn("Circle 10 is the current supported cap.", capped_experience_text)
            self.assertIn("Next step: use `boon`", capped_experience_text)
            character.execute_cmd("exp")
            milestone_skill_id = milestone_skill_for_guild_circle(guild_id, character.db.circle)
            milestone_before = (character.db.skills[milestone_skill_id]["rank"] * 5) + character.db.skills[milestone_skill_id]["pool"]
            milestone_text = "\n".join(
                use_guild_milestone(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn(guild_circle_perk(guild_id, character.db.circle), milestone_text)
            self.assertIn(character.db.skills[milestone_skill_id]["name"], milestone_text)
            milestone_after = (character.db.skills[milestone_skill_id]["rank"] * 5) + character.db.skills[milestone_skill_id]["pool"]
            self.assertGreater(milestone_after, milestone_before)
            character.execute_cmd("milestone")
            character.execute_cmd("guild lesson")
            milestone_command_after = (character.db.skills[milestone_skill_id]["rank"] * 5) + character.db.skills[milestone_skill_id]["pool"]
            self.assertGreater(milestone_command_after, milestone_after)
            reloaded_milestone = ObjectDB.objects.get(id=character.id)
            reloaded_milestone_after = (reloaded_milestone.db.skills[milestone_skill_id]["rank"] * 5) + reloaded_milestone.db.skills[milestone_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_milestone_after, milestone_command_after)
            perk_before = (character.db.skills[milestone_skill_id]["rank"] * 5) + character.db.skills[milestone_skill_id]["pool"]
            perk_text = "\n".join(
                use_guild_perk(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn(GUILD_CIRCLE_PERK_NAMES[guild_id][character.db.circle - 1], perk_text)
            self.assertIn("Circle 10", perk_text)
            perk_after = (character.db.skills[milestone_skill_id]["rank"] * 5) + character.db.skills[milestone_skill_id]["pool"]
            self.assertGreater(perk_after, perk_before)
            character.execute_cmd("perk")
            character.execute_cmd("circle perk")
            perk_command_after = (character.db.skills[milestone_skill_id]["rank"] * 5) + character.db.skills[milestone_skill_id]["pool"]
            self.assertGreater(perk_command_after, perk_after)
            reloaded_perk = ObjectDB.objects.get(id=character.id)
            reloaded_perk_after = (reloaded_perk.db.skills[milestone_skill_id]["rank"] * 5) + reloaded_perk.db.skills[milestone_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_perk_after, perk_command_after)
            primary_skill_id = primary_skill_for_guild(guild_id)
            focus_before = (character.db.skills[primary_skill_id]["rank"] * 5) + character.db.skills[primary_skill_id]["pool"]
            character.execute_cmd("focus")
            character.execute_cmd("guild focus")
            focus_after = (character.db.skills[primary_skill_id]["rank"] * 5) + character.db.skills[primary_skill_id]["pool"]
            self.assertGreater(focus_after, focus_before)
            reloaded_focus = ObjectDB.objects.get(id=character.id)
            reloaded_focus_after = (reloaded_focus.db.skills[primary_skill_id]["rank"] * 5) + reloaded_focus.db.skills[primary_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_focus_after, focus_after)
            signature_skill_id = GUILD_SIGNATURES[guild_id]["skill"]
            signature_before = (character.db.skills[signature_skill_id]["rank"] * 5) + character.db.skills[signature_skill_id]["pool"]
            signature_text = "\n".join(
                use_guild_signature(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                    }
                )
            )
            self.assertIn(GUILD_SIGNATURES[guild_id]["name"], signature_text)
            self.assertIn(character.db.skills[signature_skill_id]["name"], signature_text)
            signature_after = (character.db.skills[signature_skill_id]["rank"] * 5) + character.db.skills[signature_skill_id]["pool"]
            self.assertGreater(signature_after, signature_before)
            character.execute_cmd("signature")
            character.execute_cmd("guild signature")
            signature_command_after = (character.db.skills[signature_skill_id]["rank"] * 5) + character.db.skills[signature_skill_id]["pool"]
            self.assertGreater(signature_command_after, signature_after)
            reloaded_signature = ObjectDB.objects.get(id=character.id)
            reloaded_signature_after = (reloaded_signature.db.skills[signature_skill_id]["rank"] * 5) + reloaded_signature.db.skills[signature_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_signature_after, signature_command_after)
            mentor_skill_id = GUILD_MENTORS[guild_id]["skill"]
            mentor_before = (character.db.skills[mentor_skill_id]["rank"] * 5) + character.db.skills[mentor_skill_id]["pool"]
            mentor_text = "\n".join(
                use_guild_mentor(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn(GUILD_MENTORS[guild_id]["name"], mentor_text)
            self.assertIn("Circle 10", mentor_text)
            mentor_after = (character.db.skills[mentor_skill_id]["rank"] * 5) + character.db.skills[mentor_skill_id]["pool"]
            self.assertGreater(mentor_after, mentor_before)
            character.execute_cmd("mentor")
            character.execute_cmd("ask mentor")
            mentor_command_after = (character.db.skills[mentor_skill_id]["rank"] * 5) + character.db.skills[mentor_skill_id]["pool"]
            self.assertGreater(mentor_command_after, mentor_after)
            reloaded_mentor = ObjectDB.objects.get(id=character.id)
            reloaded_mentor_after = (reloaded_mentor.db.skills[mentor_skill_id]["rank"] * 5) + reloaded_mentor.db.skills[mentor_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_mentor_after, mentor_command_after)
            technique_skill_id = GUILD_TECHNIQUES[guild_id]["skill"]
            technique_before = (character.db.skills[technique_skill_id]["rank"] * 5) + character.db.skills[technique_skill_id]["pool"]
            character.execute_cmd("technique")
            character.execute_cmd("guild technique")
            technique_after = (character.db.skills[technique_skill_id]["rank"] * 5) + character.db.skills[technique_skill_id]["pool"]
            self.assertGreater(technique_after, technique_before)
            reloaded_technique = ObjectDB.objects.get(id=character.id)
            reloaded_technique_after = (reloaded_technique.db.skills[technique_skill_id]["rank"] * 5) + reloaded_technique.db.skills[technique_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_technique_after, technique_after)
            passive_skill_id = GUILD_PASSIVES[guild_id]["skill"]
            passive_before = (character.db.skills[passive_skill_id]["rank"] * 5) + character.db.skills[passive_skill_id]["pool"]
            character.execute_cmd("passive")
            character.execute_cmd("guild passive")
            passive_after = (character.db.skills[passive_skill_id]["rank"] * 5) + character.db.skills[passive_skill_id]["pool"]
            self.assertGreater(passive_after, passive_before)
            reloaded_passive = ObjectDB.objects.get(id=character.id)
            reloaded_passive_after = (reloaded_passive.db.skills[passive_skill_id]["rank"] * 5) + reloaded_passive.db.skills[passive_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_passive_after, passive_after)
            drill_skill_id = GUILD_DRILLS[guild_id]["skill"]
            drill_before = (character.db.skills[drill_skill_id]["rank"] * 5) + character.db.skills[drill_skill_id]["pool"]
            character.execute_cmd("drill")
            character.execute_cmd("guild drill")
            drill_after = (character.db.skills[drill_skill_id]["rank"] * 5) + character.db.skills[drill_skill_id]["pool"]
            self.assertGreater(drill_after, drill_before)
            reloaded_drill = ObjectDB.objects.get(id=character.id)
            reloaded_drill_after = (reloaded_drill.db.skills[drill_skill_id]["rank"] * 5) + reloaded_drill.db.skills[drill_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_drill_after, drill_after)
            practice_before = (character.db.skills[primary_skill_id]["rank"] * 5) + character.db.skills[primary_skill_id]["pool"]
            character.execute_cmd("practice")
            character.execute_cmd("guild practice")
            practice_after = (character.db.skills[primary_skill_id]["rank"] * 5) + character.db.skills[primary_skill_id]["pool"]
            self.assertGreater(practice_after, practice_before)
            reloaded_practice = ObjectDB.objects.get(id=character.id)
            reloaded_practice_after = (reloaded_practice.db.skills[primary_skill_id]["rank"] * 5) + reloaded_practice.db.skills[primary_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_practice_after, practice_after)
            rite_skill_id = GUILD_RITES[guild_id]["skill"]
            rite_before = (character.db.skills[rite_skill_id]["rank"] * 5) + character.db.skills[rite_skill_id]["pool"]
            character.execute_cmd("rite")
            character.execute_cmd("guild rite")
            rite_after = (character.db.skills[rite_skill_id]["rank"] * 5) + character.db.skills[rite_skill_id]["pool"]
            self.assertGreater(rite_after, rite_before)
            reloaded_rite = ObjectDB.objects.get(id=character.id)
            reloaded_rite_after = (reloaded_rite.db.skills[rite_skill_id]["rank"] * 5) + reloaded_rite.db.skills[rite_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_rite_after, rite_after)
            circle_ten_path = "\n".join(
                guild_path_summary(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "guild_boons": character.db.guild_boons or [],
                        "guild_capstones": character.db.guild_capstones or [],
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn("Circle 5+ rite", circle_ten_path)
            self.assertIn("Circle 10 capstone available", circle_ten_path)
            character.execute_cmd("guild path")
            circle_ten_plan = "\n".join(
                guild_plan_summary(
                    {
                        "guild_id": character.db.guild_id,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                    }
                )
            )
            self.assertIn("Circle 10 is the current supported plan cap", circle_ten_plan)
            self.assertIn("(current)", circle_ten_plan)
            character.execute_cmd("plan")
            boon_skill_id = GUILD_BOONS[guild_id]["skill"]
            boon_before = (character.db.skills[boon_skill_id]["rank"] * 5) + character.db.skills[boon_skill_id]["pool"]
            character.execute_cmd("boon")
            character.execute_cmd("guild boon")
            boon_after = (character.db.skills[boon_skill_id]["rank"] * 5) + character.db.skills[boon_skill_id]["pool"]
            self.assertGreater(boon_after, boon_before)
            self.assertEqual(character.db.guild_boons, [f"{guild_id}:10"])
            reloaded_boon = ObjectDB.objects.get(id=character.id)
            self.assertEqual(reloaded_boon.db.guild_boons, [f"{guild_id}:10"])
            capstone_skill_id = GUILD_CAPSTONES[guild_id]["skill"]
            capstone_before = (character.db.skills[capstone_skill_id]["rank"] * 5) + character.db.skills[capstone_skill_id]["pool"]
            character.execute_cmd("capstone")
            character.execute_cmd("guild capstone")
            capstone_after = (character.db.skills[capstone_skill_id]["rank"] * 5) + character.db.skills[capstone_skill_id]["pool"]
            self.assertGreater(capstone_after, capstone_before)
            self.assertEqual(character.db.guild_capstones, [f"{guild_id}:10"])
            reloaded_capstone = ObjectDB.objects.get(id=character.id)
            reloaded_capstone_after = (reloaded_capstone.db.skills[capstone_skill_id]["rank"] * 5) + reloaded_capstone.db.skills[capstone_skill_id]["pool"]
            self.assertGreaterEqual(reloaded_capstone_after, capstone_after)
            self.assertEqual(reloaded_capstone.db.guild_capstones, [f"{guild_id}:10"])
            post_reward_history = "\n".join(
                guild_history_summary(
                    {
                        "guild_id": guild_id,
                        "circle": character.db.circle,
                        "guild_boons": character.db.guild_boons or [],
                        "guild_capstones": character.db.guild_capstones or [],
                    }
                )
            )
            self.assertIn(f"Circle 10 boon: {GUILD_BOONS[guild_id]['name']}", post_reward_history)
            self.assertIn(f"Circle 10 capstone: {GUILD_CAPSTONES[guild_id]['name']}", post_reward_history)
            self.assertIn("is claimed", post_reward_history)
            character.execute_cmd("rewards")
            character.execute_cmd("circle")
            capped_status_text = "\n".join(
                circle_status(
                    {
                        "guild_id": character.db.guild_id,
                        "guild_name": character.db.guild_name,
                        "circle": character.db.circle,
                        "skills": character.db.skills,
                        "guild_boons": character.db.guild_boons,
                        "guild_capstones": character.db.guild_capstones,
                        "room_guild_id": character.location.db.guild,
                    }
                )
            )
            self.assertIn("Circle 10 is the current supported cap", capped_status_text)
            self.assertIn("Next step: continue training skills", capped_status_text)
            self.assertEqual(character.db.circle, 10)

    def test_circle_ten_status_guides_unclaimed_boon_and_capstone(self):
        state = {
            "guild_id": "barbarian",
            "guild_name": GUILDS["barbarian"],
            "circle": 10,
            "skills": build_starter_skills(),
            "room_guild_id": "barbarian",
            "guild_boons": [],
            "guild_capstones": [],
        }
        boon_status = "\n".join(circle_status(state))
        self.assertIn("Next step: stand before your guild registrar and use `boon`.", boon_status)
        state["guild_boons"] = ["barbarian:10"]
        capstone_status = "\n".join(circle_status(state))
        self.assertIn("Next step: stand before your guild registrar and use `capstone`.", capstone_status)
        state["guild_capstones"] = ["barbarian:10"]
        done_status = "\n".join(circle_status(state))
        self.assertIn("Next step: continue training skills", done_status)

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
        unaffiliated_focus = use_guild_focus(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
            }
        )
        self.assertIn("join guild", "\n".join(unaffiliated_focus))
        unaffiliated_technique = use_guild_technique(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
            }
        )
        self.assertIn("join guild", "\n".join(unaffiliated_technique))
        unaffiliated_mentor = use_guild_mentor(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
                "room_guild_id": character.location.db.guild,
            }
        )
        self.assertIn("join a guild", "\n".join(unaffiliated_mentor))
        unaffiliated_signature = use_guild_signature(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
            }
        )
        self.assertIn("join a guild", "\n".join(unaffiliated_signature))
        unaffiliated_passive = use_guild_passive(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
            }
        )
        self.assertIn("join guild", "\n".join(unaffiliated_passive))
        unaffiliated_drill = use_guild_drill(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
                "room_guild_id": character.location.db.guild,
            }
        )
        self.assertIn("join a guild", "\n".join(unaffiliated_drill))
        unaffiliated_practice = use_guild_practice(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
                "room_guild_id": character.location.db.guild,
            }
        )
        self.assertIn("join a guild", "\n".join(unaffiliated_practice))
        unaffiliated_boon = use_guild_boon(
            {
                "guild_id": character.db.guild_id,
                "circle": character.db.circle,
                "skills": character.db.skills,
                "room_guild_id": character.location.db.guild,
            }
        )
        self.assertIn("join a guild", "\n".join(unaffiliated_boon))

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

    def test_study_rooms_and_registrars_train_scholarship(self):
        character = self.make_character("Study Smoke")
        self.assertIn("crossing-GU02-001", STUDY_ROOMS)
        self.walk_to_room(character, "crossing-GU02-001")
        scholarship_before = character.db.skills["scholarship"]["pool"]
        arcana_before = character.db.skills["arcana"]["pool"]
        study_text = "\n".join(
            study_room(
                {
                    "guild_id": character.db.guild_id,
                    "skills": character.db.skills,
                    "room_id": character.location.db.dr_room_id,
                    "room_guild_id": character.location.db.guild,
                }
            )
        )
        self.assertIn("Arcana", study_text)
        self.assertGreater(character.db.skills["scholarship"]["pool"], scholarship_before)
        self.assertGreater(character.db.skills["arcana"]["pool"], arcana_before)
        character.execute_cmd("study")

        self.walk_to_room(character, guild_registrar_rooms()["barbarian"])
        character.execute_cmd("join guild")
        primary_skill_id = primary_skill_for_guild(character.db.guild_id)
        primary_before = character.db.skills[primary_skill_id]["pool"]
        character.execute_cmd("read")
        self.assertGreater(character.db.skills[primary_skill_id]["pool"], primary_before)

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
        self.assertIn("Accepted stock: torch, travel_rations, wild_herbs.", shop_text)
        self.assertIn("buy <item>", shop_text)
        self.assertIn("sell <item>", shop_text)
        self.assertIn("Marta trades: torch, travel_rations, wild_herbs.", shop_talk(character.location))
        self.assertIn("Available stock: torch, travel_rations, wild_herbs.", buy_item(character, ""))
        self.assertIn("I do not have small_blade for sale", buy_item(character, "small_blade"))
        self.assertIn("- 100 trias", wallet_text(character))
        character.execute_cmd("wallet")
        character.execute_cmd("shop")
        character.execute_cmd("shop talk")
        character.execute_cmd("shop stock")
        character.execute_cmd("shop refresh")
        self.assertEqual(character.location.db.shop_stock, ("torch", "travel_rations", "wild_herbs"))
        character.execute_cmd("shop stock")
        character.execute_cmd("buy torch")
        self.assertEqual(character.location.db.shop_stock, ("travel_rations", "wild_herbs"))
        character.execute_cmd("buy torch")
        self.assertEqual(character.db.inventory.count("torch"), 1)
        character.execute_cmd("shop refresh")
        self.assertEqual(character.location.db.shop_stock, ("torch", "travel_rations", "wild_herbs"))
        self.assertIn("torch", character.db.inventory)
        self.assertTrue(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "torch"
            ]
        )
        self.assertEqual(character.db.wallet["trias"], 95)
        self.assertIn("- 95 trias", wallet_text(character))

        character.execute_cmd("inventory")
        character.execute_cmd("hands")
        character.execute_cmd("money")
        character.execute_cmd("sell torch")
        self.assertNotIn("torch", character.db.inventory)
        self.assertEqual(character.location.db.shop_stock, ("torch", "travel_rations", "wild_herbs"))
        self.assertFalse(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "torch"
            ]
        )
        self.assertEqual(character.db.wallet["trias"], 97)
        self.assertIn("- 97 trias", wallet_text(character))
        character.execute_cmd("coins")

    def test_shop_tasks_reward_travel_and_trade_skills(self):
        character = self.make_character("Shop Task Smoke")
        self.assertIn(START_ROOM_ID, SHOP_TASKS)
        task_text = request_shop_task(character)
        self.assertIn("Culvert Cache", task_text)
        self.assertIn("Active task", task_status(character))
        reloaded_task_runner = ObjectDB.objects.get(id=character.id)
        self.assertEqual(reloaded_task_runner.db.active_task["name"], "South road supply note")
        self.assertEqual(reloaded_task_runner.db.active_task["destination"], "crossing-RV02-007")
        self.assertEqual(reloaded_task_runner.db.active_task["reward"], 9)
        self.assertIn("South road supply note", task_status(reloaded_task_runner))
        self.assertIn("not the task destination", complete_shop_task(character))
        self.walk_to_room(character, "crossing-RV02-007")
        wallet_before = character.db.wallet["trias"]
        trading_before = character.db.skills["trading"]["pool"]
        appraisal_before = character.db.skills["appraisal"]["pool"]
        athletics_before = character.db.skills["athletics"]["pool"]
        complete_text = complete_shop_task(character)
        self.assertIn("Shop task complete", complete_text)
        self.assertGreater(character.db.wallet["trias"], wallet_before)
        self.assertGreater(character.db.skills["trading"]["pool"], trading_before)
        self.assertGreater(character.db.skills["appraisal"]["pool"], appraisal_before)
        self.assertGreater(character.db.skills["athletics"]["pool"], athletics_before)
        self.assertIsNone(character.db.active_task)
        character.execute_cmd("task request")
        character.execute_cmd("task complete")

        towpath_runner = self.make_character("Towpath Task Smoke")
        self.walk_to_room(towpath_runner, "crossing-RV02-010")
        towpath_text = request_shop_task(towpath_runner)
        self.assertIn("Canal Edge Pack Stand", towpath_text)
        self.assertIn("crossing-RV02-008", task_status(towpath_runner))
        self.walk_to_room(towpath_runner, "crossing-RV02-008")
        towpath_wallet_before = towpath_runner.db.wallet["trias"]
        towpath_trading_before = towpath_runner.db.skills["trading"]["pool"]
        towpath_complete_text = complete_shop_task(towpath_runner)
        self.assertIn("Towpath wrap bundle", towpath_complete_text)
        self.assertIn("Shop task complete", towpath_complete_text)
        self.assertGreater(towpath_runner.db.wallet["trias"], towpath_wallet_before)
        self.assertGreater(towpath_runner.db.skills["trading"]["pool"], towpath_trading_before)
        self.assertIsNone(towpath_runner.db.active_task)

        sluice_runner = self.make_character("Sluice Task Smoke")
        self.walk_to_room(sluice_runner, "crossing-RV02-012")
        sluice_text = request_shop_task(sluice_runner)
        self.assertIn("Lockworks Dry Box", sluice_text)
        self.assertIn("crossing-RV02-011", task_status(sluice_runner))
        self.walk_to_room(sluice_runner, "crossing-RV02-011")
        sluice_wallet_before = sluice_runner.db.wallet["trias"]
        sluice_complete_text = complete_shop_task(sluice_runner)
        self.assertIn("Sluice crate tally", sluice_complete_text)
        self.assertIn("Shop task complete", sluice_complete_text)
        self.assertGreater(sluice_runner.db.wallet["trias"], sluice_wallet_before)
        self.assertIsNone(sluice_runner.db.active_task)

        spillway_runner = self.make_character("Spillway Task Smoke")
        self.walk_to_room(spillway_runner, "crossing-RV02-013")
        spillway_text = request_shop_task(spillway_runner)
        self.assertIn("Sluice Yard Crate", spillway_text)
        self.assertIn("crossing-RV02-012", task_status(spillway_runner))
        self.walk_to_room(spillway_runner, "crossing-RV02-012")
        spillway_wallet_before = spillway_runner.db.wallet["trias"]
        spillway_complete_text = complete_shop_task(spillway_runner)
        self.assertIn("Spillway rope count", spillway_complete_text)
        self.assertIn("Shop task complete", spillway_complete_text)
        self.assertGreater(spillway_runner.db.wallet["trias"], spillway_wallet_before)
        self.assertIsNone(spillway_runner.db.active_task)

        bank_runner = self.make_character("Bank Task Smoke")
        self.walk_to_room(bank_runner, "crossing-RV02-015")
        bank_text = request_shop_task(bank_runner)
        self.assertIn("Weir Watch Kit", bank_text)
        self.assertIn("crossing-RV02-014", task_status(bank_runner))
        self.walk_to_room(bank_runner, "crossing-RV02-014")
        bank_wallet_before = bank_runner.db.wallet["trias"]
        bank_complete_text = complete_shop_task(bank_runner)
        self.assertIn("Bank narrows count", bank_complete_text)
        self.assertIn("Shop task complete", bank_complete_text)
        self.assertGreater(bank_runner.db.wallet["trias"], bank_wallet_before)
        self.assertIsNone(bank_runner.db.active_task)

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
            direct_talk = talk_shopkeeper(character.location, shop["keeper"])
            self.assertIn(f"You speak with {shop['keeper']}", direct_talk)
            self.assertIn(shop["dialogue"], direct_talk)
            self.assertIn("task request", direct_talk)
            self.assertIn("Accepted stock:", direct_talk)
            stock_talk = talk_shopkeeper(character.location, f"{shop['keeper']} stock")
            self.assertIn("lists current stock", stock_talk)
            self.assertIn("buy <item>", stock_talk)
            task_talk = talk_shopkeeper(character.location, "task")
            if room_id in SHOP_TASKS:
                self.assertIn(SHOP_TASKS[room_id]["name"], task_talk)
                self.assertIn("task request", task_talk)
            else:
                self.assertIn("No shop task is open here", task_talk)
            trade_talk = talk_shopkeeper(character.location, "trade")
            self.assertIn("I trade in", trade_talk)
            self.assertIn("sell <item>", trade_talk)
            character.execute_cmd("shop")
            character.execute_cmd("shop talk")
            character.execute_cmd("talk")
            character.execute_cmd(f"ask {shop['keeper']}")
            character.execute_cmd("ask stock")
            character.execute_cmd("ask task")
            character.execute_cmd("ask trade")
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
        stow_text = remove_item(character, "small_blade")
        self.assertIn("pack it", stow_text)
        self.assertEqual(character.db.hands["right"], None)
        self.assertIn("small_blade", character.db.inventory)
        character.execute_cmd("wield small_blade")
        self.assertEqual(character.db.hands["right"], "small_blade")
        self.assertNotIn("small_blade", character.db.inventory)

        character.execute_cmd("buy leather_shield")
        self.assertEqual(character.db.hands["left"], "leather_shield")
        character.execute_cmd("wear leather_shield")
        self.assertEqual(character.db.hands["left"], None)
        self.assertIn("leather_shield", character.db.equipment["worn"])
        self.assertEqual(character.db.equipment_condition["leather_shield"], "scuffed")
        self.assertTrue(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "leather_shield"
            ]
        )
        shield_before = character.db.skills["shield_usage"]["pool"]
        armor_before = character.db.skills["light_armor"]["pool"]
        repair_text = repair_item(character, "leather_shield")
        self.assertIn("maintained", repair_text)
        self.assertEqual(character.db.equipment_condition["leather_shield"], "maintained")
        self.assertGreater(character.db.skills["shield_usage"]["pool"], shield_before)
        self.assertGreater(character.db.skills["light_armor"]["pool"], armor_before)
        character.execute_cmd("equipment")
        character.execute_cmd("repair leather_shield")
        character.execute_cmd("remove leather_shield")
        self.assertNotIn("leather_shield", character.db.equipment["worn"])
        self.assertIn("leather_shield", character.db.inventory)
        self.assertEqual(character.db.equipment_condition["leather_shield"], "maintained")
        character.execute_cmd("wear leather_shield")
        self.assertIn("leather_shield", character.db.equipment["worn"])
        self.assertNotIn("leather_shield", character.db.inventory)
        character.execute_cmd("stow small_blade")
        self.assertEqual(character.db.hands["right"], None)
        self.assertIn("small_blade", character.db.inventory)
        drop_text = drop_item(character, "small_blade")
        self.assertIn("Small Practice Blade", drop_text)
        self.assertNotIn("small_blade", character.db.inventory)
        self.assertTrue(
            [
                obj
                for obj in character.location.contents
                if obj.db.object_type == "item" and obj.db.item_id == "small_blade"
            ]
        )
        character.execute_cmd("get small_blade")
        self.assertIn("small_blade", character.db.inventory)
        character.execute_cmd("drop small_blade")
        self.assertNotIn("small_blade", character.db.inventory)

    def test_economy_equipment_and_fieldcraft_persist_after_reload(self):
        character = self.make_character("Economy Persistence Smoke")
        character.db.wallet = {"plat": 0, "trias": 500, "lucan": 0, "silk": 0}
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("buy small_blade")
        character.execute_cmd("wield small_blade")
        character.execute_cmd("shop refresh")
        character.execute_cmd("buy leather_shield")
        character.execute_cmd("wear leather_shield")
        character.execute_cmd("repair leather_shield")
        character.execute_cmd("forage")
        character.execute_cmd("get wild_herbs")

        reloaded = ObjectDB.objects.get(id=character.id)
        self.assertEqual(reloaded.location.db.dr_room_id, "crossing-RV02-002")
        self.assertEqual(reloaded.db.hands["right"], "small_blade")
        self.assertEqual(reloaded.db.hands["left"], None)
        self.assertIn("leather_shield", reloaded.db.equipment["worn"])
        self.assertEqual(reloaded.db.equipment_condition["leather_shield"], "maintained")
        self.assertIn("wild_herbs", reloaded.db.inventory)
        self.assertLess(reloaded.db.wallet["trias"], 500)
        carried_item_ids = sorted(
            obj.db.item_id
            for obj in reloaded.contents
            if obj.db.object_type == "item" and obj.db.item_id
        )
        self.assertIn("small_blade", carried_item_ids)
        self.assertIn("leather_shield", carried_item_ids)
        self.assertIn("wild_herbs", carried_item_ids)
        self.assertGreater(reloaded.db.skills["shield_usage"]["pool"], 0)
        self.assertGreater(reloaded.db.skills["outdoorsmanship"]["pool"], 0)

    def test_field_bandage_use_recovers_health_and_consumes_item(self):
        character = self.make_character("Bandage Smoke")
        self.walk_to_room(character, "crossing-RV02-006")
        character.db.health = 17
        character.db.max_health = 30
        character.execute_cmd("buy field_bandage")
        self.assertIn("field_bandage", character.db.inventory)
        bandage_text = use_item(character, "field_bandage")
        self.assertIn("recover 8 health", bandage_text)
        self.assertEqual(character.db.health, 25)
        self.assertNotIn("field_bandage", character.db.inventory)
        self.assertFalse(
            [
                obj
                for obj in character.contents
                if obj.db.object_type == "item" and obj.db.item_id == "field_bandage"
            ]
        )
        character.execute_cmd("use field_bandage")

    def test_tend_defaults_to_field_bandage_and_treats_bleeding(self):
        character = self.make_character("Tend Bandage Smoke")
        self.walk_to_room(character, "crossing-RV02-006")
        character.execute_cmd("buy field_bandage")
        character.execute_cmd("target rv-ditch-rat")
        character.execute_cmd("advance")
        combat_pressure_scripts(character)[0].at_repeat()
        combat_pressure_scripts(character)[0].at_repeat()
        self.assertTrue(character.db.bleeding)
        first_aid_before = character.db.skills["first_aid"]["pool"]
        character.execute_cmd("tend")
        self.assertFalse(character.db.bleeding)
        self.assertNotIn("field_bandage", character.db.inventory)
        self.assertGreater(character.db.skills["first_aid"]["pool"], first_aid_before)

        character.execute_cmd("shop refresh")
        character.execute_cmd("buy field_bandage")
        character.db.health = 17
        character.execute_cmd("treat field_bandage")
        self.assertEqual(character.db.health, 25)

    def test_shop_data_has_stock_and_dialogue(self):
        self.assertGreaterEqual(len(SHOPS), 4)
        self.assertIn("field_bandage", ITEMS)
        self.assertIn("rough_pelt", ITEMS)
        self.assertIn("wild_herbs", ITEMS)
        self.assertIn("wild_herbs", SHOPS["crossing-TG01-001"]["stock"])
        self.assertEqual(SHOPS["crossing-RV02-006"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-007", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-007"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-008", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-008"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-010", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-010"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-011", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-011"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-012", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-012"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-013", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-013"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-015", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-015"]["stock"][0], "field_bandage")
        self.assertIn("crossing-RV02-016", SHOPS)
        self.assertEqual(SHOPS["crossing-RV02-016"]["stock"][0], "field_bandage")
        for shop in SHOPS.values():
            self.assertTrue(shop["keeper"])
            self.assertTrue(shop["dialogue"])
            self.assertTrue(shop["stock"])
            for item_id in shop["stock"]:
                self.assertIn(item_id, ITEMS)

    def test_forage_creates_gatherable_and_trains_survival_skills(self):
        character = self.make_character("Forage Smoke")
        self.assertIn("crossing-RV02-002", FORAGE_ROOMS)
        self.assertIn("crossing-RV02-010", FORAGE_ROOMS)
        self.assertIn("crossing-RV02-011", FORAGE_ROOMS)
        self.assertIn("crossing-RV02-012", FORAGE_ROOMS)
        self.assertIn("crossing-RV02-013", FORAGE_ROOMS)
        self.assertIn("crossing-RV02-015", FORAGE_ROOMS)
        self.assertIn("crossing-RV02-016", FORAGE_ROOMS)
        self.walk_to_room(character, "crossing-RV02-002")
        outdoors_before = character.db.skills["outdoorsmanship"]["pool"]
        perception_before = character.db.skills["perception"]["pool"]
        forage_text = forage_room(character)
        self.assertIn("wild_herbs", forage_text)
        self.assertGreater(character.db.skills["outdoorsmanship"]["pool"], outdoors_before)
        self.assertGreater(character.db.skills["perception"]["pool"], perception_before)
        self.assertTrue(
            [
                obj
                for obj in character.location.contents
                if obj.db.object_type == "item" and obj.db.item_id == "wild_herbs"
            ]
        )
        character.execute_cmd("forage")
        character.execute_cmd("get wild_herbs")
        self.assertIn("wild_herbs", character.db.inventory)
        appraisal_before = character.db.skills["appraisal"]["pool"]
        appraisal_text = appraise_item(character, "wild_herbs")
        self.assertIn("Resale value: 3 trias", appraisal_text)
        self.assertGreater(character.db.skills["appraisal"]["pool"], appraisal_before)
        character.execute_cmd("appraise wild_herbs")
        self.walk_to_room(character, START_ROOM_ID)
        wallet_before = character.db.wallet["trias"]
        character.execute_cmd("sell wild_herbs")
        self.assertGreater(character.db.wallet["trias"], wallet_before)

    def test_scan_target_advance_range_and_retreat_commands(self):
        character = self.make_character("Combat Smoke")
        self.walk_to_room(character, "crossing-RV02-002")

        scan_text = scan_room(character.location)
        self.assertIn("fair difficulty", scan_text)
        self.assertIn("Suggested next command", scan_text)
        opening_guide = maneuver_guide(character)
        self.assertIn("Target: none.", opening_guide)
        self.assertIn("scan", opening_guide)
        self.assertIn("target <enemy id>", opening_guide)
        character.execute_cmd("maneuvers")
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
        missile_guide = maneuver_guide(character)
        self.assertIn("Target: Wolf Cub at missile range.", missile_guide)
        self.assertIn("aim", missile_guide)
        self.assertIn("hurl / throw", missile_guide)
        self.assertIn("advance", missile_guide)
        self.assertIn("retreat", missile_guide)
        character.execute_cmd("combat tactics")

        character.execute_cmd("appraise target")
        character.execute_cmd("combat")
        character.execute_cmd("range")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "pole")
        pole_guide = maneuver_guide(character)
        self.assertIn("Target: Wolf Cub at pole range.", pole_guide)
        self.assertIn("expect close pressure", pole_guide)
        self.assertIn("retreat", pole_guide)
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "melee")
        self.assertIn("Suggested next command: jab or bash.", combat_status(character))
        melee_guide = maneuver_guide(character)
        self.assertIn("Target: Wolf Cub at melee range.", melee_guide)
        self.assertIn("feint / fake", melee_guide)
        self.assertIn("jab / attack", melee_guide)
        self.assertIn("dodge / evade", melee_guide)
        self.assertIn("parry", melee_guide)
        self.assertIn("block / shield block", melee_guide)
        self.assertIn("wield small_blade", melee_guide)
        self.assertIn("leather_shield", melee_guide)
        character.execute_cmd("tactics guide")
        character.execute_cmd("moves")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["range"], "pole")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["range"], "missile")
        character.execute_cmd("retreat")
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(len(combat_pressure_scripts(character)), 0)
        character.execute_cmd("combat")

    def test_engaged_combat_state_persists_after_reload(self):
        character = self.make_character("Combat Persistence Smoke")
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("stance defensive")
        character.execute_cmd("target rv-wolf-cub")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        character.execute_cmd("jab")
        self.assertEqual(character.db.engagement["target"], "rv-wolf-cub")
        self.assertEqual(character.db.engagement["range"], "melee")
        self.assertEqual(len(combat_pressure_scripts(character)), 1)
        self.assertEqual(len(recovery_scripts(character)), 1)

        reloaded = ObjectDB.objects.get(id=character.id)
        self.assertEqual(reloaded.location.db.dr_room_id, "crossing-RV02-002")
        self.assertEqual(reloaded.db.engagement["target"], "rv-wolf-cub")
        self.assertEqual(reloaded.db.engagement["range"], "melee")
        self.assertEqual(reloaded.db.stance, "defensive")
        self.assertEqual(reloaded.db.balance, "recovering")
        self.assertEqual(reloaded.db.roundtime, 1)
        self.assertLess(reloaded.db.health, reloaded.db.max_health)
        self.assertEqual(len(combat_pressure_scripts(reloaded)), 1)
        self.assertEqual(len(recovery_scripts(reloaded)), 1)
        self.assertIn("Engagement: Wolf Cub at melee range.", combat_status(reloaded))

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
        feint_text = feint(character)
        self.assertIn("opening a line", feint_text)
        self.assertTrue(character.db.engagement["feinted"])
        self.assertEqual(character.db.balance, "feinting")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.skills["tactics"]["pool"], 2)
        self.assertIn("Feint: set for your next melee attack.", combat_status(character))
        character.execute_cmd("range")
        character.execute_cmd("wait")

        character.execute_cmd("stance offensive")
        self.assertEqual(character.db.stance, "offensive")
        jab_text = jab(character)
        self.assertIn("Your feint opens the strike.", jab_text)
        self.assertIn("Combat state:", jab_text)
        self.assertIn("Roundtime: 1", jab_text)
        self.assertIn("Enemy vitality: 7/14.", jab_text)
        self.assertIn("Suggested next command: wait.", jab_text)
        self.assertFalse(character.db.engagement["feinted"])
        self.assertEqual(character.db.balance, "recovering")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.health, 27)
        self.assertEqual(len(recovery_scripts(character)), 1)
        self.assertEqual(character.db.skills["small_edged"]["pool"], 2)
        self.assertEqual(character.db.skills["tactics"]["pool"], 3)
        beetle = next(
            obj
            for obj in character.location.contents
            if obj.db.npc_type == "enemy" and obj.db.enemy_id == "rv-mud-beetle"
        )
        self.assertEqual(beetle.db.vitality, 7)

        character.execute_cmd("attack")
        self.assertEqual(beetle.db.vitality, 7)
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
        character.execute_cmd("fake")
        self.assertTrue(character.db.engagement["feinted"])
        character.execute_cmd("wait")
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
        reloaded_corpse = ObjectDB.objects.get(id=corpses[0].id)
        self.assertEqual(reloaded_corpse.db.enemy_id, "rv-mud-beetle")
        self.assertEqual(reloaded_corpse.db.loot_trias, 3)
        self.assertEqual(reloaded_corpse.db.loot_items, ("torch",))
        self.assertEqual(
            [
                obj.db.item_id
                for obj in reloaded_corpse.contents
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

    def test_hurl_attacks_from_range_and_trains_light_thrown(self):
        character = self.make_character("Hurl Smoke")
        self.walk_to_room(character, "crossing-RV02-004")

        character.execute_cmd("target rv-mud-beetle")
        self.assertEqual(character.db.engagement["range"], "missile")
        aim_text = aim(character)
        self.assertIn("take careful aim", aim_text)
        self.assertTrue(character.db.engagement["aimed"])
        self.assertIn("Aim: set for your next ranged attack.", combat_status(character))
        character.execute_cmd("range")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(len(recovery_scripts(character)), 1)
        character.execute_cmd("wait")
        hurl_text = hurl(character)
        self.assertIn("You hurl at Mud Beetle", hurl_text)
        self.assertIn("careful aim adds force", hurl_text)
        self.assertIn("too far away to press back", hurl_text)
        self.assertIn("Roundtime: 1", hurl_text)
        self.assertFalse(character.db.engagement["aimed"])
        self.assertEqual(character.db.health, 30)
        self.assertEqual(character.db.skills["light_thrown"]["pool"], 2)
        self.assertEqual(character.db.skills["tactics"]["pool"], 1)
        beetle = next(
            obj
            for obj in character.location.contents
            if obj.db.npc_type == "enemy" and obj.db.enemy_id == "rv-mud-beetle"
        )
        self.assertLess(beetle.db.vitality, ENEMIES["rv-mud-beetle"]["vitality"])
        vitality_after_hurl = beetle.db.vitality
        character.execute_cmd("throw")
        self.assertEqual(beetle.db.vitality, vitality_after_hurl)
        character.execute_cmd("wait")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "pole")
        pole_text = hurl(character)
        self.assertIn("Combat state:", pole_text)
        self.assertLess(character.db.health, 30)
        character.execute_cmd("wait")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "melee")
        self.assertIn("missile or pole range", aim(character))
        melee_text = hurl(character)
        self.assertIn("missile or pole range", melee_text)
        character.execute_cmd("lob")

    def test_skin_corpse_creates_pelt_and_trains_hunting_skills(self):
        character = self.make_character("Skinning Smoke")
        self.walk_to_room(character, "crossing-RV02-005")
        character.execute_cmd("target rv-ridge-hare")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        character.execute_cmd("bash")
        character.execute_cmd("defend")
        character.execute_cmd("bash")
        corpses = corpse_objects(character.location)
        self.assertEqual(len(corpses), 1)
        skinning_before = character.db.skills["skinning"]["pool"]
        outdoors_before = character.db.skills["outdoorsmanship"]["pool"]
        skin_text = skin_corpse(character)
        self.assertIn("rough_pelt", skin_text)
        self.assertTrue(corpses[0].db.skinned)
        reloaded_skinned_corpse = ObjectDB.objects.get(id=corpses[0].id)
        self.assertTrue(reloaded_skinned_corpse.db.skinned)
        self.assertGreater(character.db.skills["skinning"]["pool"], skinning_before)
        self.assertGreater(character.db.skills["outdoorsmanship"]["pool"], outdoors_before)
        pelt_objects = [
            obj
            for obj in character.location.contents
            if obj.db.object_type == "item" and obj.db.item_id == "rough_pelt"
        ]
        self.assertTrue(pelt_objects)
        reloaded_pelt = ObjectDB.objects.get(id=pelt_objects[0].id)
        self.assertEqual(reloaded_pelt.db.item_id, "rough_pelt")
        self.assertEqual(reloaded_pelt.location.id, character.location.id)
        self.assertIn("already been skinned", skin_corpse(character))
        character.execute_cmd("skin corpse")
        character.execute_cmd("get rough_pelt")
        self.assertIn("rough_pelt", character.db.inventory)
        character.execute_cmd("loot corpse")
        self.assertEqual(corpse_objects(character.location), [])
        self.assertFalse(
            [
                obj
                for obj in character.location.contents
                if obj.db.npc_type == "enemy" and obj.db.enemy_id == "rv-ridge-hare"
            ]
        )
        self.assertEqual(room_enemy_ids(character.location), ())
        character.execute_cmd("scan")

        result = respawn_room_enemies(character.location)
        self.assertIn("Respawned: Ridge Hare.", result)
        self.assertEqual(room_enemy_ids(character.location), ("rv-ridge-hare",))
        character.execute_cmd("target rv-ridge-hare")
        self.assertEqual(character.db.engagement["target"], "rv-ridge-hare")
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
        missile_pressure_text = apply_enemy_pressure(character)
        self.assertIn("closes from missile to pole", missile_pressure_text)
        self.assertEqual(character.db.engagement["range"], "pole")
        self.assertEqual(character.db.health, 30)
        pole_pressure_text = apply_enemy_pressure(character)
        self.assertIn("closes from pole to melee", pole_pressure_text)
        self.assertEqual(character.db.engagement["range"], "melee")
        self.assertEqual(character.db.health, 30)
        melee_pressure_text = apply_enemy_pressure(character)
        self.assertIn("presses back", melee_pressure_text)
        self.assertEqual(character.db.health, 28)

        character.execute_cmd("flee")
        character.execute_cmd("rest")
        character.execute_cmd("target rv-wolf-cub")
        character.execute_cmd("advance")
        self.assertEqual(character.db.engagement["range"], "pole")

        pressure_script = combat_pressure_scripts(character)[0]
        pressure_script.at_repeat()
        self.assertEqual(character.db.engagement["range"], "melee")
        self.assertEqual(character.db.health, 28)

        character.execute_cmd("stance defensive")
        pressure_script.at_repeat()
        self.assertEqual(character.db.health, 27)
        self.assertTrue(character.db.bleeding)

    def test_field_bandage_treats_combat_bleeding(self):
        character = self.make_character("Bleeding Bandage Smoke")
        self.walk_to_room(character, "crossing-RV02-006")
        character.execute_cmd("buy field_bandage")
        character.execute_cmd("target rv-ditch-rat")
        character.execute_cmd("advance")
        pressure_script = combat_pressure_scripts(character)[0]
        pressure_script.at_repeat()
        self.assertEqual(character.db.engagement["range"], "melee")
        pressure_script.at_repeat()
        self.assertTrue(character.db.bleeding)
        self.assertEqual(len(bleeding_scripts(character)), 1)
        self.assertIn("Wounds: bleeding", health_text(character))
        self.assertIn("Suggested next command: use field_bandage.", combat_status(character))
        bleeding_scripts(character)[0].at_repeat()
        self.assertEqual(character.db.health, 27)
        first_aid_before = character.db.skills["first_aid"]["pool"]
        bandage_text = use_item(character, "field_bandage")
        self.assertIn("bleeding stops", bandage_text)
        self.assertIn("First Aid", bandage_text)
        self.assertGreater(character.db.skills["first_aid"]["pool"], first_aid_before)
        self.assertFalse(character.db.bleeding)
        self.assertEqual(len(bleeding_scripts(character)), 0)
        self.assertIn("Wounds: not bleeding", health_text(character))

    def test_bleeding_state_and_script_persist_after_reload(self):
        character = self.make_character("Bleeding Persistence Smoke")
        self.walk_to_room(character, "crossing-RV02-006")
        character.execute_cmd("target rv-ditch-rat")
        character.execute_cmd("advance")
        pressure_script = combat_pressure_scripts(character)[0]
        pressure_script.at_repeat()
        pressure_script.at_repeat()
        self.assertTrue(character.db.bleeding)
        self.assertEqual(len(bleeding_scripts(character)), 1)
        health_after_pressure = character.db.health

        reloaded = ObjectDB.objects.get(id=character.id)
        self.assertTrue(reloaded.db.bleeding)
        self.assertEqual(reloaded.db.health, health_after_pressure)
        self.assertEqual(reloaded.db.engagement["target"], "rv-ditch-rat")
        self.assertEqual(len(bleeding_scripts(reloaded)), 1)
        self.assertIn("Wounds: bleeding", health_text(reloaded))
        self.assertIn("Suggested next command: retreat and buy field_bandage.", combat_status(reloaded))
        bleeding_scripts(reloaded)[0].at_repeat()
        self.assertEqual(reloaded.db.health, health_after_pressure - 1)

    def test_bleeding_without_bandage_suggests_buying_one(self):
        character = self.make_character("Bleeding Guidance Smoke")
        self.walk_to_room(character, "crossing-RV02-006")
        character.execute_cmd("target rv-ditch-rat")
        character.execute_cmd("advance")
        pressure_script = combat_pressure_scripts(character)[0]
        pressure_script.at_repeat()
        pressure_script.at_repeat()
        self.assertTrue(character.db.bleeding)
        self.assertIn("Suggested next command: retreat and buy field_bandage.", combat_status(character))

    def test_enemy_pressure_incapacitation_and_revive(self):
        character = self.make_character("Incapacitation Smoke")
        character.db.health = 1
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("target rv-wolf-cub")
        character.execute_cmd("advance")
        pressure_script = combat_pressure_scripts(character)[0]
        pressure_script.at_repeat()
        self.assertEqual(character.db.engagement["range"], "melee")
        pressure_script.at_repeat()
        self.assertEqual(character.db.health, 0)
        self.assertTrue(character.db.incapacitated)
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(len(combat_pressure_scripts(character)), 0)
        character.execute_cmd("target rv-wolf-cub")
        self.assertEqual(character.db.engagement["target"], None)
        character.execute_cmd("rest")
        self.assertFalse(character.db.incapacitated)
        self.assertEqual(character.db.health, 15)
        self.assertEqual(character.db.roundtime, 0)
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
        dodge_text = dodge(character)
        self.assertIn("ready to dodge", dodge_text)
        self.assertEqual(character.db.stance, "defensive")
        self.assertEqual(character.db.balance, "dodging")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.skills["evasion"]["pool"], 2)
        self.assertEqual(character.db.skills["tactics"]["pool"], 2)
        dodge_health = character.db.health
        pressure_text = apply_enemy_pressure(character)
        self.assertIn("avoid the hit", pressure_text)
        self.assertEqual(character.db.health, dodge_health)
        self.assertEqual(character.db.balance, "balanced")

        character.execute_cmd("defend")
        self.assertIn("held weapon", parry(character))
        character.execute_cmd("flee")
        character.execute_cmd("rest")
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("buy small_blade")
        character.execute_cmd("target rv-wolf-cub")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        parry_text = parry(character)
        self.assertIn("Small Practice Blade", parry_text)
        self.assertEqual(character.db.stance, "defensive")
        self.assertEqual(character.db.balance, "parrying")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.skills["parry_ability"]["pool"], 2)
        self.assertEqual(character.db.skills["tactics"]["pool"], 3)
        parry_health = character.db.health
        parry_pressure_text = apply_enemy_pressure(character)
        self.assertIn("parry", parry_pressure_text)
        self.assertEqual(character.db.health, parry_health)
        self.assertEqual(character.db.balance, "balanced")

        character.execute_cmd("defend")
        self.assertIn("need a shield", block(character))
        character.execute_cmd("flee")
        character.execute_cmd("rest")
        self.walk_to_room(character, "crossing-RV02-002")
        character.execute_cmd("buy leather_shield")
        character.execute_cmd("wear leather_shield")
        character.execute_cmd("target rv-wolf-cub")
        character.execute_cmd("advance")
        character.execute_cmd("advance")
        block_text = block(character)
        self.assertIn("shield to block", block_text)
        self.assertEqual(character.db.stance, "defensive")
        self.assertEqual(character.db.balance, "blocking")
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.skills["shield_usage"]["pool"], 2)
        self.assertEqual(character.db.skills["tactics"]["pool"], 4)
        block_health = character.db.health
        block_pressure_text = apply_enemy_pressure(character)
        self.assertIn("block", block_pressure_text)
        self.assertEqual(character.db.health, block_health)
        self.assertEqual(character.db.balance, "balanced")

        character.execute_cmd("defend")
        self.assertEqual(character.db.stance, "defensive")
        self.assertEqual(character.db.roundtime, 0)
        self.assertEqual(character.db.balance, "balanced")
        character.execute_cmd("shield block")
        self.assertEqual(character.db.balance, "blocking")
        character.execute_cmd("rest")
        character.execute_cmd("parry")
        self.assertEqual(character.db.balance, "parrying")
        character.execute_cmd("rest")
        character.execute_cmd("evade")
        self.assertEqual(character.db.balance, "dodging")
        character.execute_cmd("rest")

        character.execute_cmd("flee")
        self.assertEqual(character.db.engagement["target"], None)
        self.assertEqual(character.db.roundtime, 1)
        self.assertEqual(character.db.balance, "recovering")
        self.assertEqual(len(combat_pressure_scripts(character)), 0)
        self.assertEqual(len(recovery_scripts(character)), 1)
        character.execute_cmd("rest")
        self.assertEqual(character.db.roundtime, 0)
        self.assertEqual(character.db.balance, "balanced")

        character.db.health = 20
        rest_text = rest(character)
        self.assertIn("recover 3 health", rest_text)
        self.assertEqual(character.db.health, 23)

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
        self.assertIn("rv-reed-snake", ENEMIES)
        self.assertEqual(ROOMS["crossing-RV02-007"]["targets"], ("rv-reed-snake",))
        self.assertIn("rv-marsh-spider", ENEMIES)
        self.assertEqual(ROOMS["crossing-RV02-008"]["targets"], ("rv-marsh-spider",))
        self.assertIn("rv-lockwork-crab", ENEMIES)
        self.assertEqual(ROOMS["crossing-RV02-011"]["targets"], ("rv-lockwork-crab",))
        self.assertIn("rv-bank-mink", ENEMIES)
        self.assertEqual(ROOMS["crossing-RV02-015"]["targets"], ("rv-bank-mink",))
        self.assertIn("rv-reed-heron", ENEMIES)
        self.assertEqual(ROOMS["crossing-RV02-016"]["targets"], ("rv-reed-heron",))
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
        self.assertIn(f"Milestone unlocked: {guild_circle_perk('barbarian', 2)}.", events)
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
