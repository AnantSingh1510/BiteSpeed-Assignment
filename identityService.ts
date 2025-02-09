import { Request, Response } from "express";
import { prisma } from "./app";

interface IdentifyRequest {
    email?: string;
    phoneNumber?: string;
}

const LINK_PRECEDENCE = {
    PRIMARY: 'primary' as const,
    SECONDARY: 'secondary' as const
};

export const identifyUser = async (req: Request, res: Response) => {
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

        const sameContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { email: email || undefined },
                    { phoneNumber: phoneNumber || undefined }
                ],
                deletedAt: null
            }
        });

        if (sameContacts.length === 0) {
            const newContact = await prisma.contact.create({
                data: {
                    email: email || null,
                    phoneNumber: phoneNumber || null,
                    linkPrecedence: LINK_PRECEDENCE.PRIMARY
                }
            });

            return res.status(200).json({
                contact: {
                    primaryContactId: newContact.id,
                    emails: newContact.email ? [newContact.email] : [],
                    phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
                    secondaryContactIds: [],
                }
            });
        }

        const effPrimIds = new Set<number>();
        for (const contact of sameContacts) {
            if (contact.linkPrecedence === LINK_PRECEDENCE.PRIMARY) {
                effPrimIds.add(contact.id);
            } else if (contact.linkedId) {
                effPrimIds.add(contact.linkedId);
            }
        }

        const allFilteredContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { id: { in: Array.from(effPrimIds) } },
                    { linkedId: { in: Array.from(effPrimIds) } }
                ],
                deletedAt: null
            },
            orderBy: { createdAt: 'asc' }
        });

        const primContacts = allFilteredContacts.filter(contact => 
            contact.linkPrecedence === LINK_PRECEDENCE.PRIMARY
        );
        const chosen = primContacts[0];

        if (primContacts.length > 1) {
            await prisma.contact.updateMany({
                where: {
                    id: { in: primContacts.slice(1).map(c => c.id) }
                },
                data: {
                    linkPrecedence: LINK_PRECEDENCE.SECONDARY,
                    linkedId: chosen.id,
                    updatedAt: new Date()
                }
            });
        }

        const unionEmails = new Set<string>(
            allFilteredContacts.map(c => c.email!).filter(Boolean)
        );
        const unionPhones = new Set<string>(
            allFilteredContacts.map(c => c.phoneNumber!).filter(Boolean)
        );

        if ((email && !unionEmails.has(email)) || (phoneNumber && !unionPhones.has(phoneNumber))) {
            const newContact = await prisma.contact.create({
                data: {
                    email: email || null,
                    phoneNumber: phoneNumber || null,
                    linkedId: chosen.id,
                    linkPrecedence: LINK_PRECEDENCE.SECONDARY
                }
            });
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
}