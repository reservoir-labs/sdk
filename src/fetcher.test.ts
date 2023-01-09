import { Fetcher } from './fetcher'

describe('fetcher', () => {
    it('should fetch pairs', async() => {
        const pairs = await Fetcher.fetchAllPairs(1);
        console.log(pairs);
    })
})
