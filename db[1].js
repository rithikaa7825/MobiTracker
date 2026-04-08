// LocalStorage wrapper for Ticket Data
const DB_KEY = 'mobi_tickets';

class TicketDB {
    static getTickets() {
        const data = localStorage.getItem(DB_KEY);
        if (!data) return [];
        return JSON.parse(data);
    }

    static saveTickets(tickets) {
        localStorage.setItem(DB_KEY, JSON.stringify(tickets));
    }

    static addTicket(ticketData) {
        const tickets = this.getTickets();
        
        // Auto-generate ID: SRV-1001 base
        let lastIdNum = 1000;
        if (tickets.length > 0) {
            const lastTicket = tickets[tickets.length - 1];
            const lastIdStr = lastTicket.serviceId.split('-')[1];
            lastIdNum = parseInt(lastIdStr, 10);
        }
        
        const newTicket = {
            ...ticketData,
            serviceId: `SRV-${lastIdNum + 1}`,
            dates: {
                received: new Date().toISOString().split('T')[0],
                expectedDelivery: ticketData.expectedDate,
                actualDelivery: null
            },
            status: 'Pending',
            repair: {
                workCompleted: '',
                sparePartsUsed: ''
            },
            payment: {
                serviceCharge: 0,
                sparePartsCost: 0,
                totalAmount: 0,
                status: 'Unpaid'
            }
        };

        tickets.push(newTicket);
        this.saveTickets(tickets);
        return newTicket;
    }

    static getTicket(serviceId) {
        const tickets = this.getTickets();
        return tickets.find(t => t.serviceId === serviceId);
    }

    static updateTicket(serviceId, updateData) {
        const tickets = this.getTickets();
        const index = tickets.findIndex(t => t.serviceId === serviceId);
        
        if (index !== -1) {
            tickets[index] = { ...tickets[index], ...updateData };
            
            // Re-calculate total
            if (tickets[index].payment) {
                const sc = parseFloat(tickets[index].payment.serviceCharge) || 0;
                const spc = parseFloat(tickets[index].payment.sparePartsCost) || 0;
                tickets[index].payment.totalAmount = sc + spc;
            }
            
            // Set actual delivery date if completed just now
            if (tickets[index].status === 'Completed' && !tickets[index].dates.actualDelivery) {
                tickets[index].dates.actualDelivery = new Date().toISOString().split('T')[0];
            }

            this.saveTickets(tickets);
            return tickets[index];
        }
        return null;
    }
}

// Simple Auth Wrapper
class AuthDB {
    static getCredentials() {
        const stored = localStorage.getItem('mobitracker_creds');
        if (stored) return JSON.parse(stored);
        return { email: 'admin@mobitracker.com', password: 'admin123' };
    }

    static isLoggedIn() {
        return localStorage.getItem('mobitracker_session') === 'true';
    }

    static login(email, password) {
        const creds = this.getCredentials();
        if (email === creds.email && password === creds.password) {
            localStorage.setItem('mobitracker_session', 'true');
            return true;
        }
        return false;
    }

    static logout() {
        localStorage.removeItem('mobitracker_session');
    }

    static updateCredentials(oldPassword, newEmail, newPassword) {
        const creds = this.getCredentials();
        if (oldPassword === creds.password) {
            localStorage.setItem('mobitracker_creds', JSON.stringify({ email: newEmail, password: newPassword }));
            return true;
        }
        return false; // Wrong old password
    }
}
