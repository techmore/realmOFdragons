"""
Characters

Characters are (by default) Objects setup to be puppeted by Accounts.
They are what you "see" in game. The Character class in this module
is setup to be the "default" character type created by the default
creation commands.

"""

from evennia.objects.objects import DefaultCharacter

from .objects import ObjectParent


class Character(ObjectParent, DefaultCharacter):
    """
    The Character just re-implements some of the Object's methods and hooks
    to represent a Character entity in-game.

    See mygame/typeclasses/objects.py for a list of
    properties and methods available on all Object child classes like this.

    """

    def at_object_creation(self):
        """
        Initialize clean-room DragonRealms-style character state.

        This is intentionally small for the migration scaffold. The next
        migration slices will replace the default Evennia character creator
        with race selection, in-world guild joining, and circle progression.
        """

        super().at_object_creation()
        self.db.race = "human"
        self.db.race_name = "Human"
        self.db.guild_id = "commoner"
        self.db.guild_name = "Unaffiliated"
        self.db.circle = 1
        self.db.skills = {}
        self.db.wallet = {"plat": 0, "trias": 0, "lucan": 0, "silk": 0}
