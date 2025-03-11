import React, { useState } from "react";
import { Container, Button, Spinner, Alert, Table, Form } from "react-bootstrap";
import { EC2Client, DescribeRegionsCommand, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { CloudWatchClient, GetMetricStatisticsCommand } from "@aws-sdk/client-cloudwatch";

// AWS Credentials from environment variables
const AWS_ACCESS_KEY = ""; // substitute your key here
const AWS_SECRET_KEY = ""; // substitute your key here
const DEFAULT_REGION = "us-east-1";

const Dashboard = () => {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentRegion, setCurrentRegion] = useState("");
  const [filterState, setFilterState] = useState("All");

  const fetchInstances = async () => {
    setLoading(true);
    setInstances([]);
    setCurrentRegion("Fetching available AWS regions...");

    try {
      const ec2Client = new EC2Client({
        region: DEFAULT_REGION,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY,
          secretAccessKey: AWS_SECRET_KEY,
        },
      });

      // Fetch all AWS regions
      const regionsData = await ec2Client.send(new DescribeRegionsCommand({}));
      const regions = regionsData.Regions.map((r) => r.RegionName);

      let allInstances = [];

      for (const region of regions) {
        setCurrentRegion(`Checking region: ${region}...`);

        const ec2 = new EC2Client({
          region,
          credentials: {
            accessKeyId: AWS_ACCESS_KEY,
            secretAccessKey: AWS_SECRET_KEY,
          },
        });

        const instancesData = await ec2.send(new DescribeInstancesCommand({}));

        const instancesInRegion = instancesData.Reservations.flatMap((reservation) =>
          reservation.Instances.map((instance) => ({
            id: instance.InstanceId,
            type: instance.InstanceType,
            launchTime: new Date(instance.LaunchTime).toLocaleString(),
            userId: instance.Tags?.find((tag) => tag.Key === "user_id")?.Value || "N/A",
            region,
            state: instance.State.Name, // New: Fetch instance state
          }))
        );

        for (const instance of instancesInRegion) {
          const networkUsage = await fetchNetworkUsage(region, instance.id, new Date(instance.launchTime));
          instance.networkIn = networkUsage.networkIn;
          instance.networkOut = networkUsage.networkOut;
        }

        allInstances = [...allInstances, ...instancesInRegion];
      }

      setInstances(allInstances);
      setCurrentRegion("Fetch complete.");
    } catch (error) {
      console.error("Error fetching instances:", error);
      setCurrentRegion("Error fetching instances.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNetworkUsage = async (region, instanceId, startTime) => {
    const cloudWatchClient = new CloudWatchClient({
      region,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
      },
    });

    const getNetworkUsage = async (metricName) => {
      try {
        const command = new GetMetricStatisticsCommand({
          Namespace: "AWS/EC2",
          MetricName: metricName,
          Dimensions: [{ Name: "InstanceId", Value: instanceId }],
          StartTime: startTime,
          EndTime: new Date(),
          Period: 3600,
          Statistics: ["Sum"],
        });

        const response = await cloudWatchClient.send(command);
        return response.Datapoints?.reduce((acc, dp) => acc + dp.Sum, 0) || 0;
      } catch (error) {
        console.error(`Error fetching ${metricName} for ${instanceId}:`, error);
        return 0;
      }
    };

    return {
      networkIn: await getNetworkUsage("NetworkIn"),
      networkOut: await getNetworkUsage("NetworkOut"),
    };
  };

  // Get filtered instances based on selected state
  const filteredInstances =
    filterState === "All" ? instances : instances.filter((instance) => instance.state === filterState);

  return (
    <Container className="mt-4">
      <h2 className="mb-4 text-center">AWS EC2 Dashboard</h2>

      {/* Fetch Button */}
      <div className="d-flex justify-content-between mb-3">
        <Button variant="primary" onClick={fetchInstances} disabled={loading}>
          {loading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : "Fetch Instances"}
        </Button>

        {/* Filter Dropdown */}
        <Form.Select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={{ width: "200px" }}>
          <option value="All">All States</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="terminated">Terminated</option>
          <option value="pending">Pending</option>
          <option value="shutting-down">Shutting Down</option>
          <option value="stopping">Stopping</option>
        </Form.Select>
      </div>

      {/* Loading Spinner & Status */}
      {loading && (
        <Alert variant="info" className="text-center">
          <Spinner animation="border" size="sm" /> {currentRegion}
        </Alert>
      )}

      {/* Table Display */}
      <Table striped bordered hover responsive="lg" className="mt-3 text-center">
        <thead className="table-dark">
          <tr>
            <th>Instance ID</th>
            <th>Instance Type</th>
            <th>Launch Time</th>
            <th>User ID</th>
            <th>Region</th>
            <th>State</th>
            <th>Network In (Bytes)</th>
            <th>Network Out (Bytes)</th>
          </tr>
        </thead>
        <tbody>
          {filteredInstances.length > 0 ? (
            filteredInstances.map((instance) => (
              <tr key={instance.id}>
                <td>{instance.id}</td>
                <td>{instance.type}</td>
                <td>{instance.launchTime}</td>
                <td>{instance.userId}</td>
                <td>{instance.region}</td>
                <td>
                  <span
                    className={`badge ${
                      instance.state === "running"
                        ? "bg-success"
                        : instance.state === "stopped"
                        ? "bg-danger"
                        : "bg-secondary"
                    }`}
                  >
                    {instance.state}
                  </span>
                </td>
                <td>{instance.networkIn.toLocaleString()}</td>
                <td>{instance.networkOut.toLocaleString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="text-center text-muted">
                No data available. Click "Fetch Instances" to load data.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Container>
  );
};

export default Dashboard;
