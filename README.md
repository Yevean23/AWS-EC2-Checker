# AWS-EC2-Checker
Quickly and easily check on the status of all your EC2 instances **ACROSS ALL REGIONS** in this React Component!

Requirements:
`npm install @aws-sdk/client-cloudwatch @aws-sdk/client-ec2 bootstrap react-bootstrap`

![image](https://github.com/user-attachments/assets/c3267628-d135-4bc6-b64f-05174cb5b53c)

Note: user_id is checked in the tags of the instance, it will be empty if its not present.
In my use case, it is set in the tags during the launching of the instance.
