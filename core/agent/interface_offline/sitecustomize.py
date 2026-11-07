"""Block socket access in dry-run scripts and the Python children they start."""
import sys


def block_network(event, args):
    if event.startswith("socket.") and event != "socket.__new__":
        raise PermissionError("network disabled during interface dry-run")


sys.addaudithook(block_network)
