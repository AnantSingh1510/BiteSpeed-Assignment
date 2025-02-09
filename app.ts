import express, { Request, Response } from 'express';

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

interface IdentifyRequest {
    email?: string;
    phoneNumber?: string;
}

interface IdentifyResponse {
    contact: {
        primaryContactId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    }
}

const LINK_PRECEDENCE = {
    PRIMARY: 'primary' as const,
    SECONDARY: 'secondary' as const
};

let contacts: Contact[] = [];
let nextId = 1;

const app = express();
const port = 3000;

app.use(express.json());

// @ts-ignore
app.post('/identify', async (req: Request<{}, IdentifyResponse, IdentifyRequest>, res: Response<IdentifyResponse>) => {
    try {
        const { email, phoneNumber } = req.body;

        if (!email && !phoneNumber) {
            return res.status(400).json({ 
                contact: {
                    primaryContactId: 0,
                    emails: [],
                    phoneNumbers: [],
                    secondaryContactIds: []
                }
            });
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
                linkPrecedence: LINK_PRECEDENCE.PRIMARY,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };
            contacts.push(newContact);

            return res.status(200).json({
                contact: {
                    primaryContactId: newContact.id,
                    emails: newContact.email ? [newContact.email] : [],
                    phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                    secondaryContactIds: [],
                }
            });
        }

        const contactsMap = new Map<number, Contact>();
        const effPrimIds = new Set<number>();

        for (const contact of sameContacts) {
            contactsMap.set(contact.id, contact);
            if (contact.linkPrecedence === LINK_PRECEDENCE.PRIMARY) {
                effPrimIds.add(contact.id);
            } else if (contact.linkedId) {
                effPrimIds.add(contact.linkedId);
                contactsMap.set(contact.linkedId, contacts.find(c => c.id === contact.linkedId)!);
            }
        }

        let allFilteredContacts = Array.from(contactsMap.values());
        const primContacts = allFilteredContacts.filter(contact => contact.linkPrecedence === LINK_PRECEDENCE.PRIMARY);
        const chosen = primContacts.reduce((prev, curr) => prev.createdAt <= curr.createdAt ? prev : curr);

        for (const contact of primContacts) {
            if (contact.id !== chosen.id) {
                contact.linkPrecedence = LINK_PRECEDENCE.SECONDARY;
                contact.linkedId = chosen.id;
                contact.updatedAt = new Date();
            }
        }

        const unionEmails = new Set<string>(allFilteredContacts.map(c => c.email!).filter(Boolean));
        const unionPhones = new Set<string>(allFilteredContacts.map(c => c.phoneNumber!).filter(Boolean));

        if ((email && !unionEmails.has(email)) || (phoneNumber && !unionPhones.has(phoneNumber))) {
            const newContact: Contact = {
                id: nextId++,
                email: email || null,
                phoneNumber: phoneNumber || null,
                linkedId: chosen.id,
                linkPrecedence: LINK_PRECEDENCE.SECONDARY,
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
            };
            contacts.push(newContact);
            allFilteredContacts.push(newContact);
        }

        const emails = new Set<string>();
        const phones = new Set<string>();

        for (const contact of allFilteredContacts) {
            if (contact.email) emails.add(contact.email);
            if (contact.phoneNumber) phones.add(contact.phoneNumber);
        }

        let emailsArr = Array.from(emails);
        let phoneArr = Array.from(phones);

        if (chosen.email) {
            emailsArr = [chosen.email, ...emailsArr.filter(e => e !== chosen.email)];
        }
        if (chosen.phoneNumber) {
            phoneArr = [chosen.phoneNumber, ...phoneArr.filter(p => p !== chosen.phoneNumber)];
        }

        const secondaryIds = allFilteredContacts
            .filter(contact => contact.linkPrecedence === LINK_PRECEDENCE.SECONDARY)
            .map(contact => contact.id)
            .sort((a, b) => a - b);

        return res.status(200).json({
            contact: {
                primaryContactId: chosen.id,
                emails: emailsArr,
                phoneNumbers: phoneArr,
                secondaryContactIds: secondaryIds,
            }
        });

    } catch(err) {
        console.error("An error occurred:", err);
        return res.status(500).json({
            contact: {
                primaryContactId: 0,
                emails: [],
                phoneNumbers: [],
                secondaryContactIds: []
            }
        });
    }
});

app.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
});