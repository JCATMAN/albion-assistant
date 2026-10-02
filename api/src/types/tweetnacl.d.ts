declare module 'tweetnacl' {
  interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  namespace nacl {
    namespace sign {
      function keyPair(): SignKeyPair;
      function detached(
        message: Uint8Array,
        secretKey: Uint8Array,
      ): Uint8Array;
    }
  }

  export = nacl;
}
