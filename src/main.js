import { Databases, Client, Functions ,Account} from 'node-appwrite';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import sodium from "sodium-native";
import dotenv from "dotenv";
dotenv.config();
 


export default async ({ req, res, log, error }) => {
   
    
        const cipherText=req.body
        const decryptedData=decryptObject(
        cipherText ,
        Buffer.from(process.env.NONCEHASH, "hex"),
        Buffer.from(process.env.KEY, "hex")
      
      )

    //retrieve the data from decrypted object
    const documentId_temp = decryptedData.documentId;
    const databaseId = decryptedData.databaseId;
    const collectionId_temp = decryptedData.collectionId
    const commitBucketId=process.env.commit_Bucket_Id
    const randomDocId = uuidv4(); 
    try {
            // for smart contract client
            const externalClient = new Client();
            externalClient
            .setEndpoint('https://cloud.appwrite.io/v1')
            .setKey(process.env.EXTERNAL_API_KEY)
            .setProject(process.env.EXTERNAL_PROJECT_ID);
            const databases = new Databases(externalClient);

            const document = await databases.getDocument(databaseId, collectionId_temp, documentId_temp);
            const txIdToCheck=document.txId
            const allDocuments = await databases.listDocuments(databaseId,commitBucketId);

            // Check if txIdToCheck exists in any document's txid field
            const foundDocument = allDocuments.documents.find(document => document.txId === txIdToCheck);

            if (foundDocument) {
                log(`Document with txId ${txIdToCheck} already exists in commit bucket.`);

            } else {
                await databases.createDocument(databaseId, commitBucketId ,randomDocId, {
                name:document.name,
                id:document.id,
                status:"txn verified",
                txId: txIdToCheck,

                });

                await databases.deleteDocument(databaseId, collectionId_temp, documentId_temp);
                log(`Document with txId ${txIdToCheck} does not exist in commit bucket.`);
            }
            
            return res.send("triggered");
       

        } catch (error1) {
        error('Error accessing document: ' + error1);
        return res.send("Not added to commit bucket"+error1);
        }
            
};



const decryptObject = (ciphertextHex, nonceHex, key) => {
    // Decode hexadecimal strings to buffers
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const nonce = Buffer.from(nonceHex, "hex");
 
    // Decrypt the ciphertext
    const decrypted = Buffer.alloc(
      ciphertext.length - sodium.crypto_secretbox_MACBYTES
    );
    if (sodium.crypto_secretbox_open_easy(decrypted, ciphertext, nonce, key)) {
      // Parse the decrypted string back into an object
      const decryptedObj = JSON.parse(decrypted.toString());
      return decryptedObj;
    } else {
      throw new Error("Decryption failed!");
    }
  };