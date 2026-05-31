"""
Clean-room Crossing economy helpers for the Evennia migration.

This starts with Attribute-backed item state so commands, smoke tests, and
world data can stabilize before promoting individual inventory entries to
full Evennia Object instances.
"""

from evennia import create_object

from world.dr_progression import apply_skill_pool_gain

ITEMS = {
    "torch": {
        "name": "Torch",
        "price": 5,
        "sell": 2,
        "slot": "held",
        "description": "A pitch torch wrapped for travel.",
    },
    "travel_rations": {
        "name": "Travel Rations",
        "price": 8,
        "sell": 3,
        "slot": "pack",
        "description": "Dry trail food packed in waxed cloth.",
    },
    "small_blade": {
        "name": "Small Practice Blade",
        "price": 35,
        "sell": 14,
        "slot": "right",
        "description": "A blunt-edged practice blade for basic drills.",
    },
    "leather_shield": {
        "name": "Leather Shield",
        "price": 30,
        "sell": 12,
        "slot": "left",
        "description": "A round shield faced with boiled leather.",
    },
    "practice_arrows": {
        "name": "Bundle of Practice Arrows",
        "price": 12,
        "sell": 4,
        "slot": "pack",
        "description": "A tied bundle of light practice arrows.",
    },
    "field_bandage": {
        "name": "Field Bandage",
        "price": 10,
        "sell": 4,
        "slot": "pack",
        "description": "A clean cloth wrap packed for quick field treatment.",
    },
    "rough_pelt": {
        "name": "Rough Pelt",
        "price": 0,
        "sell": 6,
        "slot": "pack",
        "description": "A rough beginner pelt cleaned enough for a shop counter.",
    },
    "wild_herbs": {
        "name": "Wild Herbs",
        "price": 1,
        "sell": 3,
        "slot": "pack",
        "description": "A small bundle of trail herbs useful for beginner fieldcraft.",
    },
}

SHOPS = {
    "crossing-TG01-001": {
        "name": "Town Green Provisioner",
        "keeper": "Marta",
        "dialogue": "Marta says, 'Roads are safer when you carry light and plan ahead.'",
        "stock": ("torch", "travel_rations", "wild_herbs"),
    },
    "crossing-RV02-002": {
        "name": "Riverside Field Outfitter",
        "keeper": "Dannen",
        "dialogue": "Dannen says, 'Keep your shield up and your footing steady.'",
        "stock": ("small_blade", "leather_shield", "practice_arrows"),
    },
    "crossing-GU10-001": {
        "name": "Guildhall Arms Table",
        "keeper": "Kresh",
        "dialogue": "Kresh says, 'Training gear is cheap. Bad habits are not.'",
        "stock": ("small_blade", "leather_shield"),
    },
    "crossing-RV02-006": {
        "name": "Drainage Trail Peddler",
        "keeper": "Sella",
        "dialogue": "Sella says, 'The low cuts are wet, quick, and mean to unprepared hands.'",
        "stock": ("field_bandage", "travel_rations", "torch"),
    },
    "crossing-RV02-007": {
        "name": "Culvert Cache",
        "keeper": "Oren",
        "dialogue": "Oren says, 'Reeds hide more than water. Keep a wrap and light close.'",
        "stock": ("field_bandage", "torch", "travel_rations"),
    },
    "crossing-RV02-008": {
        "name": "Canal Edge Pack Stand",
        "keeper": "Vessa",
        "dialogue": "Vessa says, 'Past the culvert, everything is wet enough to slow you down.'",
        "stock": ("field_bandage", "travel_rations", "wild_herbs"),
    },
    "crossing-RV02-009": {
        "name": "Orchard Verge Basket",
        "keeper": "Merrin",
        "dialogue": "Merrin says, 'Crows are bold near the old trees. Carry food and keep your hands clear.'",
        "stock": ("travel_rations", "wild_herbs", "torch"),
    },
    "crossing-RV02-010": {
        "name": "Towpath Supply Shelf",
        "keeper": "Jarik",
        "dialogue": "Jarik says, 'The old towpath is shallow, but the footing lies. Keep wraps dry.'",
        "stock": ("field_bandage", "torch", "wild_herbs"),
    },
    "crossing-RV02-011": {
        "name": "Lockworks Dry Box",
        "keeper": "Nera",
        "dialogue": "Nera says, 'If you hear claws on stone, keep your boots out of the pools.'",
        "stock": ("field_bandage", "travel_rations", "torch"),
    },
    "crossing-RV02-012": {
        "name": "Sluice Yard Crate",
        "keeper": "Tovin",
        "dialogue": "Tovin says, 'The sluice rats pull gear into the cracks. Buy what you need before stepping east.'",
        "stock": ("field_bandage", "torch", "travel_rations"),
    },
}

FORAGE_ROOMS = {
    "crossing-RV02-001": {"item": "wild_herbs", "text": "You search the trailhead verge and find wild_herbs."},
    "crossing-RV02-002": {"item": "wild_herbs", "text": "You sort through the brushline and find wild_herbs."},
    "crossing-RV02-009": {"item": "wild_herbs", "text": "You search under the old orchard verge and find wild_herbs."},
    "crossing-RV02-005": {"item": "wild_herbs", "text": "You check the low ridge grasses and find wild_herbs."},
    "crossing-RV02-007": {"item": "wild_herbs", "text": "You part the reeds around the culvert and find wild_herbs."},
    "crossing-RV02-008": {"item": "wild_herbs", "text": "You search the canal edge silt and find wild_herbs."},
    "crossing-RV02-010": {"item": "wild_herbs", "text": "You check moss along the flooded towpath and find wild_herbs."},
    "crossing-RV02-011": {"item": "wild_herbs", "text": "You pry useful greens from cracks in the ruined lockworks and find wild_herbs."},
    "crossing-RV02-012": {"item": "wild_herbs", "text": "You search damp crate seams in the sluice yard and find wild_herbs."},
}

SHOP_TASKS = {
    "crossing-TG01-001": {
        "name": "South road supply note",
        "destination": "crossing-RV02-007",
        "reward": 9,
        "text": "Marta asks you to carry a supply note to the Culvert Cache.",
    },
    "crossing-RV02-007": {
        "name": "Culvert stock tally",
        "destination": "crossing-TG01-001",
        "reward": 9,
        "text": "Oren asks you to report a culvert stock tally back to the Town Green Provisioner.",
    },
    "crossing-RV02-010": {
        "name": "Towpath wrap bundle",
        "destination": "crossing-RV02-008",
        "reward": 7,
        "text": "Jarik asks you to carry a dry wrap bundle back to the Canal Edge Pack Stand.",
    },
    "crossing-RV02-012": {
        "name": "Sluice crate tally",
        "destination": "crossing-RV02-011",
        "reward": 8,
        "text": "Tovin asks you to bring a crate tally back to the Lockworks Dry Box.",
    },
}


def coins(wallet):
    wallet = wallet or {}
    return int(wallet.get("trias", 0) or 0)


def set_coins(wallet, amount):
    wallet = dict(wallet or {})
    wallet["trias"] = max(0, int(amount))
    wallet.setdefault("plat", 0)
    wallet.setdefault("lucan", 0)
    wallet.setdefault("silk", 0)
    return wallet


def wallet_text(character):
    """Return a command-first wallet summary."""

    ensure_economy_state(character)
    wallet = character.db.wallet or {}
    return "\n".join(
        [
            "Wallet:",
            f"- {int(wallet.get('plat', 0) or 0)} plat",
            f"- {int(wallet.get('trias', 0) or 0)} trias",
            f"- {int(wallet.get('lucan', 0) or 0)} lucan",
            f"- {int(wallet.get('silk', 0) or 0)} silk",
            "Use `shop`, `buy <item>`, `sell <item>`, or `task request` to work with coin.",
        ]
    )


def ensure_economy_state(character):
    if not character.db.wallet:
        character.db.wallet = {"plat": 0, "trias": 100, "lucan": 0, "silk": 0}
    elif coins(character.db.wallet) <= 0:
        character.db.wallet = set_coins(character.db.wallet, 100)
    if character.db.inventory is None:
        character.db.inventory = []
    if character.db.hands is None:
        character.db.hands = {"left": None, "right": None}
    if character.db.equipment is None:
        character.db.equipment = {"worn": []}
    if character.db.equipment_condition is None:
        character.db.equipment_condition = {}


def current_shop(room):
    if not room:
        return None
    return SHOPS.get(room.db.dr_room_id)


def current_stock(room):
    shop = current_shop(room)
    if not shop:
        return ()
    stock = room.db.shop_stock if room and room.db.shop_stock is not None else shop["stock"]
    return tuple(item_id for item_id in stock if item_id in ITEMS)


def refresh_shop_stock(room):
    shop = current_shop(room)
    if not shop:
        return "There is no shop counter here."
    room.db.shop_stock = tuple(shop["stock"])
    room.db.shop_last_refresh = "manual"
    return f"{shop['keeper']} refreshes the stock at {shop['name']}."


def remove_shop_stock(room, item_id):
    stock = list(current_stock(room))
    if item_id in stock:
        stock.remove(item_id)
    room.db.shop_stock = tuple(stock)


def add_shop_stock(room, item_id):
    shop = current_shop(room)
    if not shop or item_id not in shop["stock"]:
        return
    stock = list(current_stock(room))
    if item_id in stock:
        return
    stock.append(item_id)
    room.db.shop_stock = tuple(stock)


def format_shop_stock(room):
    shop = current_shop(room)
    if not shop:
        return "There is no shop counter here."
    stock = current_stock(room)
    lines = [
        f"{shop['name']} stock:",
        f"Refresh: {room.db.shop_last_refresh or 'initial'}.",
    ]
    for item_id in stock:
        item = ITEMS[item_id]
        lines.append(f"- {item_id}: {item['name']} ({item['price']} trias)")
    if not stock:
        lines.append("- empty")
    return "\n".join(lines)


def accepted_stock_text(shop):
    return ", ".join(shop["stock"]) if shop and shop.get("stock") else "nothing"


def create_item_object(item_id, location, home=None):
    item = ITEMS[item_id]
    item_obj = create_object(
        "typeclasses.objects.Item",
        key=item["name"],
        location=location,
        home=home or location,
    )
    item_obj.db.item_id = item_id
    item_obj.db.desc = item["description"]
    item_obj.save()
    return item_obj


def carried_item_objects(character, item_id=None):
    objects = [
        obj
        for obj in character.contents
        if obj.db.object_type == "item" and obj.db.item_id
    ]
    if item_id:
        return [obj for obj in objects if obj.db.item_id == item_id]
    return objects


def format_shop(room):
    shop = current_shop(room)
    if not shop:
        return "There is no shop counter here."
    lines = [
        f"{shop['name']} is watched by {shop['keeper']}.",
        f"{shop['keeper']} can `shop talk`, `shop stock`, `buy <item>`, and `sell <item>`.",
        f"Accepted stock: {accepted_stock_text(shop)}.",
        "Goods for sale:",
    ]
    stock = current_stock(room)
    for item_id in stock:
        item = ITEMS[item_id]
        lines.append(f"{item_id}: {item['name']} - {item['price']} trias")
    if not stock:
        lines.append("- empty; use `shop refresh` if the keeper should restock.")
    return "\n".join(lines)


def shop_talk(room):
    shop = current_shop(room)
    if not shop:
        return "There is no shopkeeper here."
    return "\n".join(
        [
            shop["dialogue"],
            f"{shop['keeper']} trades: {accepted_stock_text(shop)}.",
        ]
    )


def task_status(character):
    task = dict(character.db.active_task or {})
    if not task:
        return "You have no active shop task. Use `task request` at a shop counter."
    return f"Active task: {task['name']}. Destination: {task['destination']}. Reward: {task['reward']} trias."


def request_shop_task(character):
    ensure_economy_state(character)
    if character.db.active_task:
        return task_status(character)
    room_id = character.location.db.dr_room_id if character.location else ""
    task = SHOP_TASKS.get(room_id)
    shop = current_shop(character.location)
    if not task or not shop:
        return "There is no shop task available here."
    character.db.active_task = dict(task)
    return "\n".join([task["text"], task_status(character), "Suggested next command: travel to the destination and use `task complete`."])


def complete_shop_task(character):
    ensure_economy_state(character)
    task = dict(character.db.active_task or {})
    if not task:
        return "You have no active shop task to complete."
    room_id = character.location.db.dr_room_id if character.location else ""
    if room_id != task.get("destination"):
        return f"This is not the task destination. Go to {task.get('destination')}."
    reward = int(task.get("reward", 0) or 0)
    character.db.wallet = set_coins(character.db.wallet, coins(character.db.wallet) + reward)
    skills = character.db.skills or {}
    events = apply_skill_pool_gain(skills, "trading", 2)
    events.extend(apply_skill_pool_gain(skills, "appraisal", 1))
    events.extend(apply_skill_pool_gain(skills, "athletics", 1))
    character.db.skills = skills
    character.db.active_task = None
    lines = [f"You complete {task['name']} and earn {reward} trias."]
    lines.extend(events)
    lines.append("Shop task complete.")
    return "\n".join(lines)


def buy_item(character, item_id):
    ensure_economy_state(character)
    shop = current_shop(character.location)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not shop:
        return "There is no shop counter here."
    if not item_id:
        return f"Buy what? Available stock: {', '.join(current_stock(character.location)) or 'nothing'}."
    if item_id not in current_stock(character.location) or item_id not in ITEMS:
        return f'{shop["keeper"]} says, "I do not have {item_id} for sale." Available stock: {", ".join(current_stock(character.location)) or "nothing"}.'
    item = ITEMS[item_id]
    wallet = character.db.wallet
    if coins(wallet) < item["price"]:
        return f"You need {item['price']} trias to buy {item['name']}."

    character.db.wallet = set_coins(wallet, coins(wallet) - item["price"])
    remove_shop_stock(character.location, item_id)
    inventory = list(character.db.inventory or [])
    hands = dict(character.db.hands or {"left": None, "right": None})
    item_obj = create_item_object(item_id, character, character.location)
    if item["slot"] in ("left", "right") and not hands.get(item["slot"]):
        hands[item["slot"]] = item_id
        character.db.hands = hands
        return f"You buy {item['name']} for {item['price']} trias and hold it in your {item['slot']} hand."
    inventory.append(item_id)
    character.db.inventory = inventory
    return f"You buy {item['name']} for {item['price']} trias."


def sell_item(character, item_id):
    ensure_economy_state(character)
    shop = current_shop(character.location)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not shop:
        return "There is no shop counter here."
    if not item_id:
        return f"Sell what? {shop['keeper']} buys: {accepted_stock_text(shop)}."
    if item_id not in ITEMS:
        return f'Unknown item "{item_id}".'
    if item_id not in shop["stock"]:
        return f'{shop["keeper"]} says, "I do not trade in {item_id}." Accepted stock: {accepted_stock_text(shop)}.'

    inventory = list(character.db.inventory or [])
    hands = dict(character.db.hands or {"left": None, "right": None})
    source = None
    if item_id in inventory:
        inventory.remove(item_id)
        source = "pack"
        objects = carried_item_objects(character, item_id)
        if objects:
            objects[0].delete()
    else:
        for hand, held_item_id in hands.items():
            if held_item_id == item_id:
                hands[hand] = None
                source = hand
                objects = carried_item_objects(character, item_id)
                if objects:
                    objects[0].delete()
                break
    if not source:
        return f"You are not carrying {ITEMS[item_id]['name']}. Check `inventory`, `hands`, and `equipment`."

    item = ITEMS[item_id]
    character.db.inventory = inventory
    character.db.hands = hands
    character.db.wallet = set_coins(character.db.wallet, coins(character.db.wallet) + item["sell"])
    add_shop_stock(character.location, item_id)
    return f"You sell {item['name']} from your {source} for {item['sell']} trias."


def appraise_item(character, item_id):
    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Appraise what? Try `appraise <item id>` or `appraise target`."
    item = ITEMS.get(item_id)
    if not item:
        return f'Unknown item "{item_id}".'

    inventory = list(character.db.inventory or [])
    hands = dict(character.db.hands or {"left": None, "right": None})
    worn = list((character.db.equipment or {}).get("worn", []))
    in_room = any(obj.db.object_type == "item" and obj.db.item_id == item_id for obj in character.location.contents)
    in_shop = item_id in current_stock(character.location)
    visible = item_id in inventory or item_id in hands.values() or item_id in worn or in_room or in_shop
    if not visible:
        return f'You do not see or carry "{item_id}" to appraise.'

    skills = character.db.skills or {}
    events = apply_skill_pool_gain(skills, "appraisal", 2)
    character.db.skills = skills
    condition = (character.db.equipment_condition or {}).get(item_id)
    lines = [
        f"{item['name']} ({item_id})",
        f"Shop price: {item['price']} trias. Resale value: {item['sell']} trias.",
        f"Use: {item['description']}",
    ]
    if condition:
        lines.append(f"Condition: {condition}.")
    lines.extend(events)
    lines.append("Suggested next command: buy, sell, get, wear, wield, use, or repair as appropriate.")
    return "\n".join(lines)


def forage_room(character):
    ensure_economy_state(character)
    room_id = character.location.db.dr_room_id if character.location else ""
    forage = FORAGE_ROOMS.get(room_id)
    if not forage:
        return "You find no useful forage here. Try the trailhead, brushline, ridge, or culvert."
    item_id = forage["item"]
    create_item_object(item_id, character.location, character.location)
    skills = character.db.skills or {}
    events = apply_skill_pool_gain(skills, "outdoorsmanship", 2)
    events.extend(apply_skill_pool_gain(skills, "perception", 1))
    character.db.skills = skills
    lines = [forage["text"]]
    lines.extend(events)
    lines.append(f"Suggested next command: get {item_id}.")
    return "\n".join(lines)


def get_item(character, item_id):
    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Get what?"
    for obj in list(character.location.contents):
        if obj.db.object_type == "item" and obj.db.item_id == item_id:
            inventory = list(character.db.inventory or [])
            inventory.append(item_id)
            character.db.inventory = inventory
            item = ITEMS.get(item_id, {"name": obj.key})
            obj.location = character
            obj.home = character.location
            obj.save()
            return f"You pick up {item['name']}."
    return f'You do not see "{item_id}" here.'


def wield_item(character, item_id):
    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Wield what?"
    item = ITEMS.get(item_id)
    if not item:
        return f'Unknown item "{item_id}".'
    if item["slot"] != "right":
        return f"{item['name']} is not a weapon you can wield."

    inventory = list(character.db.inventory or [])
    if item_id not in inventory or not carried_item_objects(character, item_id):
        return f"You are not carrying {item['name']}."
    hands = dict(character.db.hands or {"left": None, "right": None})
    if hands.get("right"):
        return "Your right hand is already full."
    inventory.remove(item_id)
    hands["right"] = item_id
    character.db.inventory = inventory
    character.db.hands = hands
    return f"You wield {item['name']} in your right hand."


def wear_item(character, item_id):
    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Wear what?"
    item = ITEMS.get(item_id)
    if not item:
        return f'Unknown item "{item_id}".'
    if item["slot"] not in ("left", "armor"):
        return f"{item['name']} is not wearable gear."

    inventory = list(character.db.inventory or [])
    hands = dict(character.db.hands or {"left": None, "right": None})
    source = None
    if item_id in inventory and carried_item_objects(character, item_id):
        inventory.remove(item_id)
        source = "pack"
    elif hands.get("left") == item_id and carried_item_objects(character, item_id):
        hands["left"] = None
        source = "left hand"
    if not source:
        return f"You are not carrying {item['name']}."

    equipment = dict(character.db.equipment or {"worn": []})
    worn = list(equipment.get("worn", []))
    if item_id in worn:
        return f"You are already wearing {item['name']}."
    worn.append(item_id)
    equipment["worn"] = worn
    conditions = dict(character.db.equipment_condition or {})
    conditions.setdefault(item_id, "scuffed")
    character.db.inventory = inventory
    character.db.hands = hands
    character.db.equipment = equipment
    character.db.equipment_condition = conditions
    return f"You wear {item['name']} from your {source}."


def remove_item(character, item_id):
    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Remove what? Try `remove <worn or held item>`."
    item = ITEMS.get(item_id)
    if not item:
        return f'Unknown item "{item_id}".'

    inventory = list(character.db.inventory or [])
    hands = dict(character.db.hands or {"left": None, "right": None})
    equipment = dict(character.db.equipment or {"worn": []})
    worn = list(equipment.get("worn", []))
    source = None
    if item_id in worn:
        worn.remove(item_id)
        source = "worn gear"
    else:
        for hand, held_item_id in hands.items():
            if held_item_id == item_id:
                hands[hand] = None
                source = f"{hand} hand"
                break
    if not source:
        return f"You are not wearing or holding {item['name']}."
    if not carried_item_objects(character, item_id):
        return f"You cannot find {item['name']} among your carried gear."

    if item_id not in inventory:
        inventory.append(item_id)
    equipment["worn"] = worn
    character.db.inventory = inventory
    character.db.hands = hands
    character.db.equipment = equipment
    return f"You remove {item['name']} from your {source} and pack it."


def drop_item(character, item_id):
    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Drop what?"
    item = ITEMS.get(item_id)
    if not item:
        return f'Unknown item "{item_id}".'

    inventory = list(character.db.inventory or [])
    hands = dict(character.db.hands or {"left": None, "right": None})
    equipment = dict(character.db.equipment or {"worn": []})
    worn = list(equipment.get("worn", []))
    source = None
    if item_id in inventory:
        inventory.remove(item_id)
        source = "pack"
    elif item_id in worn:
        worn.remove(item_id)
        source = "worn gear"
    else:
        for hand, held_item_id in hands.items():
            if held_item_id == item_id:
                hands[hand] = None
                source = f"{hand} hand"
                break
    if not source:
        return f"You are not carrying {item['name']}."

    objects = carried_item_objects(character, item_id)
    if not objects:
        return f"You cannot find {item['name']} among your carried gear."
    obj = objects[0]
    obj.location = character.location
    obj.home = character.location
    obj.save()
    equipment["worn"] = worn
    character.db.inventory = inventory
    character.db.hands = hands
    character.db.equipment = equipment
    return f"You drop {item['name']} from your {source}."


def repair_item(character, item_id):
    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Repair what? Try `repair <worn or held item>`."
    item = ITEMS.get(item_id)
    if not item:
        return f'Unknown item "{item_id}".'
    hands = dict(character.db.hands or {"left": None, "right": None})
    worn = list((character.db.equipment or {}).get("worn", []))
    carried = item_id in worn or item_id in hands.values()
    if not carried or not carried_item_objects(character, item_id):
        return f"You need to wear or hold {item['name']} before repairing it."

    conditions = dict(character.db.equipment_condition or {})
    before = conditions.get(item_id, "scuffed")
    conditions[item_id] = "maintained"
    character.db.equipment_condition = conditions
    skills = character.db.skills or {}
    events = []
    if item_id == "leather_shield":
        events.extend(apply_skill_pool_gain(skills, "shield_usage", 2))
        events.extend(apply_skill_pool_gain(skills, "light_armor", 1))
    else:
        events.extend(apply_skill_pool_gain(skills, "engineering", 1))
    character.db.skills = skills
    lines = [f"You repair {item['name']}, improving its condition from {before} to maintained."]
    lines.extend(events)
    if not events:
        lines.append("You learn a little from the maintenance work.")
    return "\n".join(lines)


def use_item(character, item_id):
    """Use a carried consumable item."""

    ensure_economy_state(character)
    item_id = (item_id or "").strip().lower().replace(" ", "_")
    if not item_id:
        return "Use what?"
    item = ITEMS.get(item_id)
    if not item:
        return f'Unknown item "{item_id}".'
    if item_id != "field_bandage":
        return f"{item['name']} has no immediate use."

    inventory = list(character.db.inventory or [])
    if item_id not in inventory or not carried_item_objects(character, item_id):
        return f"You are not carrying {item['name']}."
    max_health = int(character.db.max_health or 30)
    current_health = int(character.db.health if character.db.health is not None else max_health)
    if current_health >= max_health:
        return "You are already at full health."

    healed = min(8, max_health - current_health)
    character.db.health = current_health + healed
    was_bleeding = bool(character.db.bleeding)
    if was_bleeding:
        from world.dr_combat import stop_bleeding

        stop_bleeding(character)
    else:
        character.db.bleeding = False
    inventory.remove(item_id)
    character.db.inventory = inventory
    objects = carried_item_objects(character, item_id)
    if objects:
        objects[0].delete()
    bleeding_text = " The bleeding stops." if was_bleeding else ""
    from world.dr_progression import apply_skill_pool_gain

    skills = character.db.skills or {}
    skill_events = apply_skill_pool_gain(skills, "first_aid", 2)
    character.db.skills = skills
    training_text = (" " + " ".join(skill_events)) if skill_events else " First Aid practice improves."
    return f"You bind the worst cuts with {item['name']} and recover {healed} health.{bleeding_text}{training_text}"


def inventory_text(character):
    ensure_economy_state(character)
    inventory = character.db.inventory or []
    if not inventory:
        return "You are carrying nothing in your pack."
    lines = ["You are carrying:"]
    for item_id in inventory:
        item = ITEMS.get(item_id, {"name": item_id})
        lines.append(f"- {item['name']} ({item_id})")
    return "\n".join(lines)


def hands_text(character):
    ensure_economy_state(character)
    hands = character.db.hands or {"left": None, "right": None}
    lines = ["Hands:"]
    for hand in ("left", "right"):
        item_id = hands.get(hand)
        item = ITEMS.get(item_id, {"name": "Empty"})
        lines.append(f"{hand}: {item['name'] if item_id else 'Empty'}")
    return "\n".join(lines)


def equipment_text(character):
    ensure_economy_state(character)
    lines = [hands_text(character), "Worn:"]
    worn = list((character.db.equipment or {}).get("worn", []))
    if not worn:
        lines.append("- Nothing")
    for item_id in worn:
        item = ITEMS.get(item_id, {"name": item_id})
        condition = (character.db.equipment_condition or {}).get(item_id, "unmaintained")
        lines.append(f"- {item['name']} ({item_id}), condition: {condition}")
    return "\n".join(lines)
