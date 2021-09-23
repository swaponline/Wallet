[**Site**](https://www.vechain.org/grant-program/)

[**Repository on github**](https://github.com/vechain/grant-program)


## Application Process

1. **Application Preparation and Submission**
   1. [Fork](https://github.com/vechain/Grant-program) this repository.
   2. In the newly created fork, create a copy of the application template ([`applications/application-template.md`](applications/application-template.md)) or the research template([`applications/research-template.md`](applications/research-template.md)). Make sure you **do not modify the template file directly**.
   3. Name the new file after your project: `project_name.md`.
   4. Fill out the template with the details of your project. The more information you provide, the faster its review process will be.
   5. Once you're done, create a pull request. The pull request should only contain _one new file_, that is the Markdown file you created from the template.
   6. Please read the [disclaimer](disclaimer.md) carefully before applying for VeChain General Grant.

2. **Preliminary Review**

   After its submission, an application enters the preliminary review stage where an evaluator will be designated to check whether it is formatted correctly and includes all the requested information. The [evaluator](#grant-evaluators) will label the pull request as "ready for committee review" if the application passes the preliminary review.
   
3. **Committee Review**

   A five-member grant committee will evaluate and make decisions on all the applications passing the preliminary review. The commitee may conditionally accept an application with further requirements for clarifications and amendments. The applicant(s) must _address all the requirements_ via a new pull request. The application will then be accepted once the pull request is approved by one committee member. Final decisions made by the committee will be put on the website to notify applicants and the community. 
 
4. **Milestone Delivery and Payment**

   Milestones are to be delivered on the [Grant Milestone Delivery](./milestone-delivery) repository. You can find the delivery process [here](milestone-delivery#milestone-delivery-process). **Once the application is accepted, the payment for the first milestone will be immediately disbursed to fund the project. The payments of the rest milestones will be disbursed once their previous milestones are delivered and reviewed.**

   The grant application can be amended at any time. However, this _necessitates a reevaluation by the committee_. If your application has been accepted and, during development, you find that your project significantly deviates from the original specification, please open a new pull request that modifies the existing application.
   
   ## Milestone Delivery Process

The milestone delivery process is part of the [General Grant Program](https://github.com/vechain/grant-program/). You can find the application process [here](https://github.com/vechain/grant-program#application-process).  

1. **Milestone Delivery:**
   1. In the fork that you used to submit the applicaiton, create a copy of the milestone delivery template ([`deliveries/milestone-delivery-template.md`](deliveries/milestone-delivery-template.md)). Make sure you **do not modify the template file directly**.
   2. Name the file `project_name-milestone_number.md`.
   3. Fill out the template with the details of your milestone including a **link to the pull request** of your application.
   4. Once you're done, create a pull request.
2. **Milestone Review:**
   1. [Evaluators](https://github.com/vechain/grant-program#grant-evaluators) will review and comment on the pull request. Their feedback needs to be resolved before your milestone is accepted.
   2. Grants Evaluators will merge your pull request to accept the delivery.
3. **Milestone Payment:**
   1. The [Operation Team](https://github.com/vechain/grant-program#operation-team) receives a notification once the delivery is accepted.
   2. Payment is made to the ERC 20 address specified in the initial application. 

If your application has been accepted and, during development, you find that your project significantly deviates from the original specification, please open a new pull request that modifies the existing application.
