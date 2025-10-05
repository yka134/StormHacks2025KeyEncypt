








async function pubKeyInput() {
    const pubKeyInputElem = document.getElementById("pub-key-input");
    const pubKeyInputValue = pubKeyInputElem.value;

    localShared = await makeDerivedKey(localKeyPair, pubKeyInputValue);
}

async function encryptText() {
    const inputText = document.getElementById("encrypt-input").value;
    const encryptedMessage64 = await generateEncryptedMessage(localShared, inputText);
    document.getElementById("encrypted-text").innerHTML = encryptedMessage64;
}


async function decryptText() {
    const inputText = document.getElementById("decrypt-input").value;
    const decrypted = await decryptEncryptedMessage(localShared, inputText);
    document.getElementById("result-text").innerText = decrypted;
}

async function main() {
    try {
        localKeyPair = await makeKeys();
        const base64Key = await makeKeyToSend(localKeyPair);
        console.log(base64Key);
        document.getElementById("public-key-text").innerHTML = base64Key;


    } catch (error) {
        console.error(error);
    }
}


async function testEncryptionFlow() {
    const keyPairA = await makeKeys();
    const keyPairB = await makeKeys();

    const pubA = await makeKeyToSend(keyPairA);
    const pubB = await makeKeyToSend(keyPairB);

    const sharedA = await makeDerivedKey(keyPairA, pubB);
    const sharedB = await makeDerivedKey(keyPairB, pubA);

    const encryptedMessage64 = await generateEncryptedMessage(sharedA, "Hello World!");
    console.log("Encrypted (base 64): ", encryptedMessage64);

    const decrypted = await decryptEncryptedMessage(sharedB, encryptedMessage64);
    console.log("Decrypted: ", decrypted);
}





main();

//testEncryptionFlow();