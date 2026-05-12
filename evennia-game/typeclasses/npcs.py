"""
NPC typeclasses for the Evennia migration.
"""

from evennia.objects.objects import DefaultObject

from .objects import ObjectParent


class Shopkeeper(ObjectParent, DefaultObject):
    """
    Minimal shopkeeper NPC.

    Shop behavior still lives in command/economy helpers for now; the NPC
    anchors the shopkeeper in the room so players can see and target a real
    world object before deeper dialogue/economy behavior is promoted.
    """

    def at_object_creation(self):
        super().at_object_creation()
        self.db.npc_type = "shopkeeper"


class Enemy(ObjectParent, DefaultObject):
    """
    Minimal enemy NPC for deployed Crossing hunting rooms.
    """

    def at_object_creation(self):
        super().at_object_creation()
        self.db.npc_type = "enemy"
