import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Image,
  Input,
  SimpleGrid,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { Alchemy, Network, Utils } from "alchemy-sdk";
import { useState } from "react";

function App() {
  const [userAddress, setUserAddress] = useState("");
  const [results, setResults] = useState([]);
  const [hasQueried, setHasQueried] = useState(false);
  const [tokenDataObjects, setTokenDataObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setError("MetaMask not found. Please install MetaMask.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      setWalletAddress(accounts[0]);
      setUserAddress(accounts[0]); // autofill input
      setError("");
    } catch (err) {
      setError("Failed to connect wallet.");
    }
  }

  async function getTokenBalance() {
    setError("");

    try {
      setLoading(true);
      setHasQueried(false);

      const config = {
        apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
        network: Network.ETH_MAINNET,
      };

      const alchemy = new Alchemy(config);

      let resolvedAddress = userAddress;
      if (userAddress.includes(".")) {
        try {
          const lookup = await alchemy.core.resolveName(userAddress);

          if (!lookup) {
            setError("ENS name not found.");
            setLoading(false);
            return;
          }

          resolvedAddress = lookup;
        } catch (err) {
          setError("Failed to resolve ENS name.");
          setLoading(false);
          return;
        }
      }

      const data = await alchemy.core.getTokenBalances(resolvedAddress);
      setResults(data);

      const tokenDataPromises = data.tokenBalances.map((token) =>
        alchemy.core.getTokenMetadata(token.contractAddress)
      );

      setTokenDataObjects(await Promise.all(tokenDataPromises));

      setHasQueried(true);
    } catch (err) {
      setError("Something went wrong while fetching token balances.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box w="100vw">
      <Center>
        <Flex
          alignItems={"center"}
          justifyContent="center"
          flexDirection={"column"}
        >
          <Heading mb={0} fontSize={36}>
            ERC-20 Token Indexer
          </Heading>
          <Text>
            Plug in an address and this website will return all of its ERC-20
            token balances!
          </Text>
        </Flex>
      </Center>
      <Flex
        w="100%"
        flexDirection="column"
        alignItems="center"
        justifyContent={"center"}
      >
        <Heading mt={42}>
          Get all the ERC-20 token balances of this address:
        </Heading>
        <Flex mt={4} gap={4} align="center">
          <Button onClick={connectWallet} bg="purple.500" color="white">
            {walletAddress ? "Wallet Connected" : "Connect Wallet"}
          </Button>

          {walletAddress && (
            <Box
              bg="purple.700"
              color="white"
              px={3}
              py={1}
              borderRadius="md"
              fontSize="sm"
            >
              {walletAddress.substring(0, 6)}...
              {walletAddress.substring(walletAddress.length - 4)}
            </Box>
          )}
        </Flex>

        <Input
          onChange={(e) => setUserAddress(e.target.value)}
          color="black"
          w="600px"
          textAlign="center"
          p={4}
          bgColor="white"
          fontSize={24}
        />
        <Button
          fontSize={20}
          onClick={getTokenBalance}
          mt={36}
          bgColor="blue"
          isLoading={loading}
          loadingText="Fetching"
          isDisabled={loading || !userAddress}
        >
          Check ERC-20 Token Balances
        </Button>

        <Heading my={36}>ERC-20 token balances:</Heading>

        {error && (
          <Box
            bg="red.500"
            color="white"
            px={4}
            py={2}
            borderRadius="md"
            mb={4}
          >
            {error}
          </Box>
        )}

        {loading && (
          <Center mt={8}>
            <Flex direction="column" align="center" gap={4}>
              <Spinner size="xl" />
              <Text>Fetching token balances...</Text>
            </Flex>
          </Center>
        )}

        {!loading && !hasQueried && !error && (
          <Center mt={8}>
            <Text opacity={0.7}>
              Enter an address and click the button above.
            </Text>
          </Center>
        )}

        {!loading && hasQueried && (
          <SimpleGrid w={"90vw"} columns={[1, 2, 3, 4]} spacing={8}>
            {results.tokenBalances.map((e, i) => (
              <Flex
                key={i}
                direction="column"
                bg="blue.600"
                color="white"
                p={4}
                borderRadius="lg"
                shadow="md"
              >
                <Text>
                  <b>Symbol:</b> {tokenDataObjects[i].symbol}
                </Text>
                <Text>
                  <b>Balance:</b>{" "}
                  {Utils.formatUnits(
                    e.tokenBalance,
                    tokenDataObjects[i].decimals
                  )}
                </Text>
                <Image
                  mt={2}
                  src={tokenDataObjects[i].logo}
                  maxW="40px"
                  alt="token-logo"
                />
              </Flex>
            ))}
          </SimpleGrid>
        )}
      </Flex>
    </Box>
  );
}

export default App;
