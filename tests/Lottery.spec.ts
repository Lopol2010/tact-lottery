import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { fromNano, toNano } from '@ton/core';
import { Lottery } from '../wrappers/Lottery';
import '@ton/test-utils';

describe('Lottery', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let depositors: SandboxContract<TreasuryContract>[] = [];
    let lottery: SandboxContract<Lottery>;
    let maxParticipants = 25;
    let deadline = Math.floor(Date.now() / 1000) + 60 * 60;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // blockchain.now = deadline - 60*60;
        // console.log(blockchain.now, deadline)
        lottery = blockchain.openContract(await Lottery.fromInit(BigInt(deadline), BigInt(maxParticipants)));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await lottery.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: lottery.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and lottery are ready to use
    });

    it('should deposit', async () => {
        for (let i = 0; i < 25; i++) {
            let depositor = await blockchain.treasury('depositor' + i, { balance: toNano("2.0") });
            depositors.push(depositor);
        }

        for (let i = 0; i < depositors.length; i++) {

            const depositor = depositors[i];

            const depositAmount = BigInt(toNano("1.0"));

            const depositResult = await lottery.send(
                depositor.getSender(),
                {
                    value: depositAmount,
                },
                null
            );

            expect(depositResult.transactions).toHaveTransaction({
                from: depositor.address,
                to: lottery.address,
                success: true,
            });

            const balance = await lottery.getBalance();
            expect(balance).toBeGreaterThan(0n);
        }

        const balanceBeforeRewards = await lottery.getBalance();
        // it doesn't work with BigInt so I made this quickfix with Numbers
        expect(Number(balanceBeforeRewards)/1e9).toBeCloseTo(Number(toNano(maxParticipants.toString()))/1e9, 0);

        const depositor = deployer;

        const depositAmount = BigInt(toNano("1.0"));

        const depositResult = await lottery.send(
            depositor.getSender(),
            {
                value: depositAmount,
            },
            null
        );

        let sortedDepositors = (await Promise.all(depositors.map(d => d.getBalance()))).map(n => Number(n) - 1e9).sort((a, b) => b - a);
        expect(sortedDepositors[0] / (maxParticipants * 1e9) * 100).toBeCloseTo(50, 0)
        expect(sortedDepositors[1] / (maxParticipants * 1e9) * 100).toBeCloseTo(30, 0)
        expect(sortedDepositors[2] / (maxParticipants * 1e9) * 100).toBeCloseTo(20, 0)

    });
});