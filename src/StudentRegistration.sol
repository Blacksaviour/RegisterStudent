// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract StudentRegistration {
    struct Student {
        string name;
        uint256 age;
        string course;
    }

    mapping(address => Student) private students;
    mapping(address => bool) public registered;
    address[] private studentAddresses;

    function register(
        string memory _name,
        uint256 _age,
        string memory _course
    ) public {
        require(!registered[msg.sender], "Student already registered");

        students[msg.sender] = Student(_name, _age, _course);
        registered[msg.sender] = true;
        studentAddresses.push(msg.sender);
    }

    function studentCount() public view returns (uint256) {
        return studentAddresses.length;
    }

    function getStudentAddress(uint256 _index) public view returns (address) {
        return studentAddresses[_index];
    }

    function getStudent(address _student)
        public
        view
        returns (
            string memory name,
            uint256 age,
            string memory course
        )
    {
        require(registered[_student], "Student not registered");

        Student memory student = students[_student];

        return (student.name, student.age, student.course);
    }
}