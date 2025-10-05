# Gibkey

A browser extension that allow for end-to-end encryption on any messaging platform (such as Discord) using **ECDH** and **AES-GCM** encryption. Outsiders reading the encrypted messages might as well be reading GIBBERISH

![GibKey](GibKey.jpg)

## Features

- Generate a unique public/private key pair per user
- Easily share public keys as a Base64 string
- Automatically decrypt any encrypted messages
- No messages are stored; all encryption/decryption happens locally in the browser

## Installation

1. Clone the repository
2. Load the extension into your browser
    - Open Chrome
    - Go to `chrome://extensions/`
    - Enable developer mode
    - Click `Load Unpacked` and select the project folder

## Usage

1. *Copy My Public Key* and paste to friend (through a messaging application)
2. Receive friend's public key
3. Paste in friend's public key and *Scan Key*
4. Begin to type message to friend through messaging application
5. Before sending message, use Ctrl+Shift+E (or Cmd+Shift+E for Mac) to copy the encrypted message to clipboard
6. Remove original message (Ctrl+a, backspace) and paste (Ctrl+v)
7. Begin sending encrypted messages to friend
8. Press *Decrypt Text on Screen* to visually decrypt messages on your screen, friend is also able to do so (does not change the actual message)

