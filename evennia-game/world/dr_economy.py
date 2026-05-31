"""
Clean-room Crossing economy helpers for the Evennia migration.

This starts with Attribute-backed item state so commands, smoke tests, and
world data can stabilize before promoting individual inventory entries to
full Evennia Object instances.
"""

from evennia import create_object

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
}

SHOPS = {
    "crossing-TG01-001": {
        "name": "Town Green Provisioner",
        "keeper": "Marta",
        "dialogue": "Marta says, 'Roads are safer when you carry light and plan ahead.'",
        "stock": ("torch", "travel_rations"),
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
    character.db.inventory = inventory
    character.db.hands = hands
    character.db.equipment = equipment
    return f"You wear {item['name']} from your {source}."


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
    inventory.remove(item_id)
    character.db.inventory = inventory
    objects = carried_item_objects(character, item_id)
    if objects:
        objects[0].delete()
    return f"You bind the worst cuts with {item['name']} and recover {healed} health."


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
        lines.append(f"- {item['name']} ({item_id})")
    return "\n".join(lines)
