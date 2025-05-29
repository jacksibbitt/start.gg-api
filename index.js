const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
require('dotenv').config();

const startggURL = "https://api.start.gg/gql/alpha";
const apiKey = process.env.START_GG_KEY;

// Function to get event ID
const getEventId = async (tournamentName, eventName) => {
    const eventSlug = `tournament/${tournamentName}/event/${eventName}`;
    let eventId;
    await fetch(startggURL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'Accept': 'application/json',
            Authorization: 'Bearer ' + process.env.START_GG_KEY
        },
        body: JSON.stringify({
            query: "query EventQuery($slug:String) {event(slug: $slug) {id name}}",
            variables: {
                slug: eventSlug
            },
        })
    }).then(r => r.json())
    .then(data => {
        eventId = data.data.event.id;
    });
    return eventId;
};

// Function to get tournaments by state
const getTournamentsByState = async (perPage, state) => {
    try {
        const response = await fetch(startggURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                query: `
                    query TournamentsByState($perPage: Int, $state: String!) {
                        tournaments(query: {
                            perPage: $perPage
                            filter: {
                                addrState: $state
                                upcoming: false
                                videogameIds: [1386]
                            }
                        }) {
                            nodes {
                                id
                                name
                                addrState
                            }
                        }
                    }
                `,
                variables: {
                    perPage: perPage,
                    state: state
                }
            })
        });

        const data = await response.json();
        const tournaments = data.data.tournaments.nodes;
        return tournaments;

    } catch (error) {
        console.error('Error fetching tournaments:', error);
        return [];
    }
};

// Function to get tournament IDs by state
// this will send the IDs of the tournaments. needed for utilizing data from each tournament
const getTournamentsIDByState = async (perPage, state) => {
    try {
        const response = await fetch(startggURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                query: `
                    query TournamentsByState($perPage: Int, $state: String!) {
                        tournaments(query: {
                            perPage: $perPage
                            filter: {
                                addrState: $state
                                upcoming: false
                                videogameIds: [1386]
                            }
                        }) {
                            nodes {
                                id
                                slug
                            }
                        }
                    }
                `,
                variables: {
                    perPage: perPage,
                    state: state
                }
            })
        });

        const data = await response.json();
        const tournamentIds = data.data.tournaments.nodes.map(tournament => tournament.id);
        return tournamentIds;

    } catch (error) {
        console.error('Error fetching tournament IDs:', error);
        return [];
    }
};

// Function to get tournament slugs by state
// grabs the slugs (separate from IDs)
const getTournamentsSlugByState = async (perPage, state) => {
    try {
        const response = await fetch(startggURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                query: `
                    query TournamentsByState($perPage: Int, $state: String!) {
                        tournaments(query: {
                            perPage: $perPage
                            filter: {
                                addrState: $state
                                past: true
                                videogameIds: [1386]
                                afterDate: 1743465600 
                                beforeDate: 1746057600
                            }
                        }) {
                            nodes {
                                slug
                            }
                        }
                    }
                `,
                variables: {
                    perPage: perPage,
                    state: state
                }
            })
        });

        const data = await response.json();
        const tournamentSlugs = data.data.tournaments.nodes.map(tournament => 
            tournament.slug.replace('tournament/', '')
        );
        for (let i in tournamentSlugs) {
            console.log("added tourney: " + tournamentSlugs[i]);
        }
        return tournamentSlugs;

    } catch (error) {
        console.error('Error fetching tournament slugs:', error);
        return [];
    }
};

// Function to get entrants by event
// will pull the entrants based off of a single slug. 
const getEntrantsByEvent = async (tourneySlug) => {
    try {
        const response = await fetch(startggURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                query: `
                    query PlayersAtEvent($tourneySlug: String) { 
                        tournament(slug: $tourneySlug) {
                            id
                            name
                            participants(query: { perPage: 400, page: 1 }) {
                                nodes {
                                    prefix
                                    id
                                    gamerTag
                                    prefix
                                    user {
                                        slug
                                    }
                                }
                            }
                        }
                    }
                `,
                variables: {
                    tourneySlug: tourneySlug
                }
            })
        });

        const data = await response.json();
        const entrants = data.data?.tournament?.participants?.nodes || [];

        return entrants
            .filter(entrant => entrant.user && entrant.user.slug)
            .map(entrant => entrant.user.slug.replace('user/', ''));

    } catch (error) {
        console.error('Error fetching entrants IDs:', error);
        return [];
    }
};

// Function to record attendance
//saves attendance to a text file. writes the uuids all registered for a slug. 
const recordAttendance = async (slug, attendeeList) => {
    try {
        const entrantIds = await getEntrantsByEvent(slug);

        if (entrantIds && Array.isArray(entrantIds)) {
            entrantIds.forEach(id => {
                attendeeList.push(id);
            });
        }

        return attendeeList;
    } catch (error) {
        console.error('Error recording attendance:', error);
        return attendeeList;
    }
};

// Grab all tournaments from specified criteria
// gets a list of tournaments based on specific criterea. 
const listFromCriterea = async (perPage, state, attendeeList) => {
    try {
        let tourneyList = await getTournamentsSlugByState(perPage, state);

        for (const slug of tourneyList) {
            attendeeList = await recordAttendance(slug, attendeeList);
        }

        return attendeeList;
    } catch (error) {
        console.error('Error recording attendance:', error);
        return [];
    }
};

// Main execution
let attendeeList = [];
let datelist = [];
datelist[0] = 1727803934; // Oct 1
datelist[5] = 1730505570; // Nov 1
datelist[1] = 1735666334; // Dec 31
datelist[2] = 1735752734; // Jan 1
datelist[3] = 1743442334; // Mar 31
datelist[4] = 1746120734; // Apr 1

(async () => {
    attendeeList = await listFromCriterea(345, 'IN', attendeeList);

    console.log('Attendee List:');
    attendeeList.forEach((id, index) => {
        console.log(`Added entrant with ID: ${id} at index ${index}`);
    });

    let x = 0;
    for (let i in attendeeList) {
        if (attendeeList[i] === '0f43507e') {
            x++;
        }
    }
    console.log("Number of times 0f43507e appeared - " + x);

    // Write to stats.txt
    const timeStamp = new Date().toISOString();
    const fileContent = `\n\n=== Run at ${timeStamp} ===\n${attendeeList.join('\n')}`;

    fs.appendFile('stats.txt', fileContent, (err) => {
        if (err) {
            console.error('Error writing to file:', err);
        } else {
            console.log('Attendee list appended to stats.txt');
        }
    });
})();
