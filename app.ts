import express, { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client';

// I am simulating test data, will connect to SQL database later.
interface Contact {
    id: number;
    phoneNumber: string | null;
    email: string | null;
    linkedId: number | null;
    linkPrecedence: "primary" | "secondary";
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

let contacts: Contact[] = [];
let nextId = 1;

// const prisma = new PrismaClient(); // will use prisma or ORM mapping later
const app = express();
const port = 3000;

app.use(express.json());


// @ts-ignore
app.post('/identify', async (req: Request, res: Response) => {
    try {
        const { email, phoneNumber } = req.body;
        if (!email && !phoneNumber) {
            return res.status(400).json({ message: 'Insufficient info provided' })
        }

        const sameContacts = contacts.filter(contact => 
        (email && contact.email === email) || (phoneNumber && contact.phoneNumber === phoneNumber)
        );

        if (sameContacts.length === 0) {
            const newContact: Contact = {
                id: nextId++,
                email: email || null,
                phoneNumber: phoneNumber || null,
                linkedId: null,
                linkPrecedence: "primary",
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            }
            contacts.push(newContact);

            return res.status(200).json({
                contact: {
                    primaryContatctId: newContact.id,
                    emails: newContact.email ? [newContact.email] : [],
                    phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                    secondaryContactIds: [],
                }
            })
        }

        const effPrimIds = new Set<number>();

        for (const contact of sameContacts) {
            if (contact.linkPrecedence === "primary") {
                effPrimIds.add(contact.id);
            } else if (contact.linkedId) {
                effPrimIds.add(contact.linkedId);
            }
        }

        let allFilteredContacts = contacts.filter(contact => 
            effPrimIds.has(contact.id) || (contact.linkedId !== null && effPrimIds.has(contact.linkedId))
        );

        const primContacts = allFilteredContacts.filter(contact => contact.linkPrecedence === "primary");
        const chosen = primContacts.reduce((prev, curr) => prev.createdAt <= curr.createdAt ? prev : curr);

        for (const contact of primContacts) {
            if (contact.id !== chosen.id) {
                contact.linkPrecedence = "secondary";
                contact.linkedId = chosen.id;
                contact.updatedAt = new Date();
            }
        }

        const emails = new Set<string>();
        const phones = new Set<string>();

        for (const contact of allFilteredContacts) {
            if (contact.email){
                emails.add(contact.email);
            }
            if (contact.phoneNumber) {
                phones.add(contact.phoneNumber);
            }
        }

        let emailsArr = Array.from(emails);
        let phoneArr = Array.from(phones);

        if (chosen.email) {
            emailsArr = [chosen.email, ...emailsArr.filter(e => e !== chosen.email)];
        }
        if (chosen.phoneNumber) {
            phoneArr = [chosen.phoneNumber, ...phoneArr.filter(p => p !== chosen.phoneNumber)]
        }

        const secondaryIds = allFilteredContacts
            .filter(contact => contact.linkPrecedence === "secondary")
            .map(contact => contact.id)
            .sort((a, b) => a - b);


        return res.status(200).json({
            contact: {
                primaryContatctId: chosen.id,
                emails: emailsArr,
                phoneNumbers: phoneArr,
                secondaryContactIds: secondaryIds,
            }
        });

    } catch(err) {
        console.error("An error occured:", err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
  });