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
  VStack,
  HStack,
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
  const [activeAddress, setActiveAddress] = useState("");
  const [tokenMetadataCache, setTokenMetadataCache] = useState({});
  const [sortBy, setSortBy] = useState("symbol");

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setError("MetaMask not found. Please install MetaMask.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const address = accounts[0];

      setWalletAddress(address);
      setUserAddress(address);

      await fetchBalances(address);
    } catch {
      setError("Failed to connect wallet.");
    }
  }

  function disconnectWallet() {
    setWalletAddress("");
  }

  async function fetchBalances(address) {
    setError("");

    try {
      setLoading(true);
      setHasQueried(false);

      const config = {
        apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
        network: Network.ETH_MAINNET,
      };

      const alchemy = new Alchemy(config);

      let resolvedAddress = address;

      // ENS resolution
      if (address.includes(".")) {
        const lookup = await alchemy.core.resolveName(address);

        if (!lookup) {
          setError("ENS name not found.");
          setLoading(false);
          return;
        }

        resolvedAddress = lookup;
      }

      setActiveAddress(resolvedAddress);

      const data = await alchemy.core.getTokenBalances(resolvedAddress);
      setResults(data);

      const newMetadata = {};
      const metadataPromises = [];

      data.tokenBalances.forEach((token) => {
        const address = token.contractAddress;

        if (!tokenMetadataCache[address]) {
          metadataPromises.push(
            alchemy.core.getTokenMetadata(address).then((meta) => ({
              status: "fulfilled",
              address,
              meta,
            }))
          );
        }
      });

      const settled = await Promise.allSettled(metadataPromises);

      settled.forEach((result) => {
        if (result.status === "fulfilled" && result.value?.meta) {
          newMetadata[result.value.address] = result.value.meta;
        }
      });

      setTokenMetadataCache((prev) => ({
        ...prev,
        ...newMetadata,
      }));

      const mergedMetadata = data.tokenBalances.map(
        (token) =>
          newMetadata[token.contractAddress] ||
          tokenMetadataCache[token.contractAddress]
      );

      setTokenDataObjects(mergedMetadata);

      setHasQueried(true);
    } catch (err) {
      setError("Something went wrong while fetching token balances.");
    } finally {
      setLoading(false);
    }
  }
  const sortedTokenBalances = hasQueried
    ? [...results.tokenBalances].sort((a, b) => {
        const metaA = tokenDataObjects[results.tokenBalances.indexOf(a)];
        const metaB = tokenDataObjects[results.tokenBalances.indexOf(b)];

        if (!metaA || !metaB) return 0;

        if (sortBy === "symbol") {
          return (metaA.symbol || "").localeCompare(metaB.symbol || "");
        }

        if (sortBy === "balance") {
          const balA = Number(
            Utils.formatUnits(a.tokenBalance, metaA.decimals)
          );
          const balB = Number(
            Utils.formatUnits(b.tokenBalance, metaB.decimals)
          );
          return balB - balA;
        }

        return 0;
      })
    : [];

  return (
    <Box minH="100vh" bg="gray.50">
      <Box maxW="1200px" mx="auto" px={6} py={10}>
        {/* Header */}
        <Center mb={10}>
          <Flex direction="column" align="center" gap={2}>
            <Heading size="xl">ERC-20 Token Indexer</Heading>
            <Text color="gray.600" textAlign="center">
              View ERC-20 token balances for any wallet or your connected
              wallet.
            </Text>
          </Flex>
        </Center>

        {/* Wallet Card */}
        <Box borderRadius="xl" borderWidth="1px" borderColor="red.400" mb={8}>
          <VStack>
            <Text fontWeight="medium" mb={4}>
              Want to quickly see your own balances?
            </Text>

            <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
              {!walletAddress ? (
                <Button onClick={connectWallet}>Connect Wallet</Button>
              ) : (
                <VStack>
                  <Box
                    bg="purple.100"
                    color="purple.700"
                    px={3}
                    py={1}
                    borderRadius="md"
                    fontSize="sm"
                    fontWeight="medium"
                  >
                    Connected: {walletAddress.slice(0, 6)}...
                    {walletAddress.slice(-4)}
                  </Box>
                  <HStack>
                    <Button onClick={disconnectWallet}>Disconnect</Button>

                    <Button onClick={() => fetchBalances(walletAddress)}>
                      View Wallet
                    </Button>
                  </HStack>
                </VStack>
              )}
            </Flex>

            {activeAddress && (
              <Text mt={4} fontSize="sm" color="gray.600">
                Viewing balances for{" "}
                <b>
                  {activeAddress.slice(0, 6)}...
                  {activeAddress.slice(-4)}
                </b>
              </Text>
            )}
          </VStack>
        </Box>

        {/* Address Input */}
        <Box borderRadius="xl" p={6} shadow="sm" mb={8}>
          <Flex direction="column" gap={4}>
            <Center>
              <Input
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                placeholder="Enter wallet address or ENS (e.g. vitalik.eth)"
                size="xl"
                variant="outline"
              />
            </Center>
            <Center>
              <Button
                onClick={() => fetchBalances(userAddress)}
                isLoading={loading}
                isDisabled={loading || !userAddress}
              >
                Check Token Balances
              </Button>
            </Center>
          </Flex>
        </Box>
        {hasQueried && (
          <Flex justify="flex-end" mb={4}>
            <Flex align="center" gap={2}>
              <Text fontSize="sm" color="gray.600">
                Sort by:
              </Text>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E0",
                }}
              >
                <option value="symbol">Symbol (A–Z)</option>
                <option value="balance">Balance (High → Low)</option>
              </select>
            </Flex>
          </Flex>
        )}

        {/* Results */}
        {error && (
          <Box bg="red.500" color="white" p={3} borderRadius="md" mb={6}>
            {error}
          </Box>
        )}

        {loading && (
          <Center py={10}>
            <Flex direction="column" align="center" gap={4}>
              <Spinner />
              <Text color="gray.600">Fetching token balances…</Text>
            </Flex>
          </Center>
        )}

        {!loading && hasQueried && (
          <SimpleGrid columns={[1, 2, 3, 4]} spacing={6}>
            {sortedTokenBalances.map((e, i) => {
              const meta = tokenDataObjects[results.tokenBalances.indexOf(e)];

              if (!meta) return null;

              return (
                <Box
                  key={e.contractAddress}
                  p={5}
                  borderRadius="xl"
                  maxW="200px"
                  borderWidth="1px"
                  borderColor="gray.200"
                  _hover={{ shadow: "md" }}
                >
                  <Flex align="center" gap={3} mb={3}>
                    {meta.logo ? (
                      <Image
                        src={meta.logo}
                        boxSize="32px"
                        borderRadius="full"
                      />
                    ) : (
                      <Flex
                        boxSize="32px"
                        borderRadius="full"
                        bg="purple.500"
                        align="center"
                        justify="center"
                        color="white"
                        fontWeight="bold"
                        fontSize="sm"
                      >
                        {meta.symbol?.[0] || "?"}
                      </Flex>
                    )}

                    <Text fontWeight="bold">{meta.symbol || "Unknown"}</Text>
                  </Flex>

                  <Text fontSize="sm" color="gray.500">
                    Balance
                  </Text>

                  <Text fontWeight="medium" isTruncated>
                    {Utils.formatUnits(e.tokenBalance, meta.decimals)}
                  </Text>
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </Box>
    </Box>
  );
}

export default App;
